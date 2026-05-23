import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Rutas base del proyecto
 */
export const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Directorios principales
 */
export const SPECS_DIR = join(PROJECT_ROOT, "specs");
export const RESOURCES_DIR = join(PROJECT_ROOT, "resources");
export const OUTPUT_DIR = join(PROJECT_ROOT, "output");

/**
 * Configuración de flujos
 */
export const FLOW_CONFIG_PATH = join(SPECS_DIR, "flow-configuration.json");

/**
 * Directorios de specs
 */
export const SCHEMAS_DIR = join(SPECS_DIR, "schemas");
export const TEMPLATES_DIR = join(SPECS_DIR, "templates");
