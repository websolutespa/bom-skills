import { format } from '@websolutespa/oxc/oxfmt';
import { defineConfig } from 'oxfmt';

// the shared BOM style (100 columns, single quotes, trailing commas es5); generated files are ignored.
// Project ignores: defineConfig({ ...format, ignorePatterns: [...ignorePatterns, 'some/dir/**'] })
export default defineConfig(format);
