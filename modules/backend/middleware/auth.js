/**
 * Middleware de Autenticação
 */

const jwt = require('jsonwebtoken');

/**
 * Verifica o token JWT
 */
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query?.token;

    if (!token) {
        return res.status(401).json({ message: 'Token de autenticação não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};

/**
 * Requer que o usuário seja admin
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Recurso exclusivo para administradores.' });
    }
    next();
};

/**
 * Requer que o usuário seja admin ou atendente
 */
const requireAdminOrAttendant = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'attendant') {
        return res.status(403).json({ message: 'Acesso negado. Recurso exclusivo para administradores ou atendentes.' });
    }
    next();
};

module.exports = {
    verifyToken,
    requireAdmin,
    requireAdminOrAttendant
};

