const sharp = require('sharp');

/**
 * Redimensiona uma imagem em base64 para 1280x720 (16:9).
 * @param {string} base64Input - Imagem original em base64.
 * @returns {Promise<string>} - Imagem ajustada em base64.
 */
async function ajustarPara169(base64Input) {
  const buffer = Buffer.from(base64Input, 'base64');
  const outputBuffer = await sharp(buffer)
    .resize({
      width: 1280,
      height: 720,
      fit: 'cover' // "contain" mantém imagem inteira com bordas; "cover" preenche 100%
    })
    .toFormat('png')
    .toBuffer();
  return outputBuffer.toString('base64');
}
module.exports = { ajustarPara169 };