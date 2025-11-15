const crypto = require('crypto');
const sharp = require('sharp');
const { ajustarPara169 } = require('./resize_16_9');
const { sanitizePrompt } = require('./sanitizePrompt');

const DefaultHeader = {
  Origin: "https://labs.google",
  "content-type": "application/json",
  Referer: "https://labs.google/fx/tools/image-fx"
};

const Model = Object.freeze({
  IMAGEN_3: "IMAGEN_3",
  IMAGEN_3_5: "IMAGEN_3_5"
});

const AspectRatio = Object.freeze({
  SQUARE: "IMAGE_ASPECT_RATIO_SQUARE",
  PORTRAIT: "IMAGE_ASPECT_RATIO_PORTRAIT",
  LANDSCAPE: "IMAGE_ASPECT_RATIO_LANDSCAPE",
  UNSPECIFIED: "IMAGE_ASPECT_RATIO_SQUARE"
});

class ImageFXError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ImageFXError";
    this.code = code;
  }
}

class AccountError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
  }
}

class Account {
  constructor(cookie) {
    if (!cookie?.trim()) throw new AccountError("O cookie é obrigatório.");
    this.cookie = cookie;
    this.user = null;
    this.token = null;
    this.tokenExpiry = null;
  }

  async refreshSession() {
    if (!this.token || !this.tokenExpiry || this.tokenExpiry <= new Date(Date.now() + 30000)) {
      const session = await this.fetchSession();
      if (!session?.access_token || !session?.expires || !session?.user) {
        throw new AccountError("A resposta da sessão não contém os campos esperados.");
      }
      this.user = session.user;
      this.token = session.access_token;
      this.tokenExpiry = new Date(session.expires);
    }
  }

  getAuthHeaders() {
    if (!this.token) throw new AccountError("Token ausente.");
    return {
      ...DefaultHeader,
      "Cookie": this.cookie,
      "Authorization": "Bearer " + this.token
    };
  }

  async fetchSession() {
    const res = await fetch("https://labs.google/fx/api/auth/session", {
      headers: {
        Origin: "https://labs.google",
        Referer: "https://labs.google/fx/tools/image-fx",
        "Cookie": this.cookie
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      if ([401, 403].includes(res.status)) {
        throw new AccountError(`Falha de autenticação (${res.status}). Verifique os cookies.`, res.status);
      }
      throw new AccountError(`Erro ${res.status}: ${errorText}`, res.status);
    }

    const data = await res.json();
    if (!data.access_token || !data.expires || !data.user) {
      throw new AccountError(`Resposta inválida: ${JSON.stringify(data)}`);
    }
    return data;
  }
}

class Prompt {
  constructor(args) {
    if (!args.prompt?.trim()) throw new ImageFXError("O prompt é obrigatório.");
    this.seed = args.seed ?? Math.floor(Math.random() * 2147483647);
    this.prompt = args.prompt;
    this.negativePrompt = args.negativePrompt ?? '';
    this.numberOfImages = args.numberOfImages ?? 1;
    this.aspectRatio = args.aspectRatio ?? AspectRatio.SQUARE;
    this.generationModel = ["IMAGEN_3", "IMAGEN_3_5"].includes(args.generationModel)
      ? args.generationModel
      : Model.IMAGEN_3_5;
  }

  toString() {
    const payload = {
      userInput: {
        candidatesCount: this.numberOfImages,
        prompts: [this.prompt],
        seed: this.seed
      },
      clientContext: {
        sessionId: `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        tool: "IMAGE_FX"
      },
      modelInput: {
        modelNameType: this.generationModel
      },
      aspectRatio: this.aspectRatio
    };

    if (this.negativePrompt?.trim()) {
      payload.userInput.negativePrompts = [this.negativePrompt.trim()];
    }

    return JSON.stringify(payload);
  }
}

class Image {
  constructor(args) {
    if (!args.encodedImage?.trim()) throw new ImageFXError("Imagem codificada ausente.");
    this.seed = args.seed;
    this.prompt = args.prompt;
    this.model = args.modelNameType;
    this.aspectRatio = args.aspectRatio;
    this.workflowId = args.workflowId;
    this.encodedImage = args.encodedImage;
    this.mediaId = args.mediaGenerationId;
    this.fingerprintId = args.fingerprintLogRecordId;
  }

  getImageData() {
    return {
      url: `data:image/png;base64,${this.encodedImage}`,
      prompt: this.prompt,
      mediaId: this.mediaId,
      seed: this.seed
    };
  }
}

async function isAlready169(base64) {
  const buffer = Buffer.from(base64, 'base64');
  const { width, height } = await sharp(buffer).metadata();
  const ratio = width / height;
  return Math.abs(ratio - 16 / 9) <= 0.05;
}

class ImageFX {
  constructor(cookie) {
    if (!cookie?.trim()) throw new ImageFXError("O cookie é obrigatório.");
    this.account = new Account(cookie);
  }

  _parseHumanError(text, status) {
    try {
      const json = JSON.parse(text);
      const reason = json?.error?.details?.[0]?.reason;
      const fallback = json?.error?.message || `Erro ${status}`;

      switch (reason) {
        case "PUBLIC_ERROR_UNSAFE_GENERATION":
          return "Prompt bloqueado: conteúdo inseguro.";
        case "PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED":
          return "Prompt bloqueado: uso de pessoas famosas.";
        case "PUBLIC_ERROR_QUALITY_FILTER_FAILED":
        case "PUBLIC_ERROR_AESTHETIC_FILTER_FAILED":
          return "Prompt bloqueado: qualidade ou estética baixa.";
        default:
          return reason ? `Erro não mapeado: ${reason}` : fallback;
      }
    } catch {
      return status === 429 ? "Erro 429: limite de requisições atingido." : `Erro ${status}: ${text}`;
    }
  }

  async generateImage(promptOriginal, options = {}) {
    if (!promptOriginal?.trim()) throw new ImageFXError("Prompt vazio.");

    await this.account.refreshSession();

    const { sanitized, alerts } = sanitizePrompt(promptOriginal);

    const prompt = new Prompt({
      prompt: sanitized,
      seed: options.seed,
      numberOfImages: options.numberOfImages,
      aspectRatio: options.aspectRatio,
      generationModel: Model.IMAGEN_3_5,
      negativePrompt: options.negativePrompt
    });

    const generatedData = await this.fetchImages(prompt, options.retries || 2);
    const results = [];

    for (const data of generatedData) {
      const img = new Image(data);

      if (options.resizeTo16_9 === true) {
        const precisa = !(await isAlready169(img.encodedImage));
        if (precisa) {
          img.encodedImage = await ajustarPara169(img.encodedImage);
        }
      }

      results.push({
        ...img.getImageData(),
        sanitizedPrompt: sanitized,
        wasSanitized: alerts.length > 0,
        alerts
      });
    }

    return results;
  }

  async fetchImages(prompt, retry = 0) {
    try {
      console.log("💡 Payload enviado para a API:");
      console.log(prompt.toString());

      const res = await fetch("https://aisandbox-pa.googleapis.com/v1:runImageFx", {
        method: "POST",
        body: prompt.toString(),
        headers: this.account.getAuthHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        const msg = this._parseHumanError(errText, res.status);
        throw new ImageFXError(msg, res.status);
      }

      const json = await res.json();
      const images = json?.imagePanels?.[0]?.generatedImages;
      if (!images?.length) throw new ImageFXError("A API não retornou imagens.");
      return images;

    } catch (err) {
      if (retry > 0 && !(err instanceof AccountError)) {
        console.warn(`[ImageFX] Falha ao gerar imagem. Tentando novamente... (${retry} restantes)`);
        await new Promise(res => setTimeout(res, 500));
        return this.fetchImages(prompt, retry - 1);
      }

      throw err instanceof ImageFXError ? err : new ImageFXError(`Erro inesperado: ${err.message}`);
    }
  }
}

module.exports = {
  ImageFX,
  ImageFXError,
  AccountError,
  Model,
  AspectRatio,
  Account
};