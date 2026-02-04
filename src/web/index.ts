/**
 * McServer - Web Module
 */

export { WebServer } from './server';
export { initializeAuth, authMiddleware, requireRole } from './auth';
export { setupWebSocket } from './websocket';
export { default as apiRoutes } from './routes';
