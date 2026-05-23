/**
 * Exports centralizados de todos los tipos
 */

// Flow Configuration Types
export type {
  SourceHints,
  Sources,
  OutputConfig,
  FlowDefinition,
  FlowConfig,
  ResolvedSources,
  ResolvedFlowDefinition,
} from "./FlowConfig.js";

export {
  SourceHintsSchema,
  SourcesSchema,
  OutputConfigSchema,
  FlowDefinitionSchema,
  FlowConfigSchema,
} from "./FlowConfig.js";

// Schema Types
export type {
  DomainField,
  SchemaWithHints,
  LoadedSchema,
} from "./SchemaTypes.js";

export {
  DomainFieldSchema,
  SchemaWithHintsSchema,
} from "./SchemaTypes.js";

// Template Types
export type {
  FieldMappingConfig,
  TemplateConfig,
  LoadedTemplate,
  GeneratedArtifact,
  GenerationResult,
} from "./TemplateTypes.js";

export {
  FieldMappingConfigSchema,
  TemplateConfigSchema,
} from "./TemplateTypes.js";

// Prompt Types
export type {
  PromptSection,
  PromptConfig,
  PromptConfigFile,
  LoadedPrompt,
} from "./PromptTypes.js";

export {
  PromptSectionSchema,
  PromptConfigSchema,
  PromptConfigFileSchema,
} from "./PromptTypes.js";
