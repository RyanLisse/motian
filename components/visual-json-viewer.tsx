"use client";

import { JsonEditor, type JsonValue } from "@visual-json/react";

interface VisualJsonViewerProps {
  /** The JSON data to display */
  value: Record<string, unknown>;
  /** Optional JSON Schema for schema-aware form fields, descriptions, and enum dropdowns */
  schema?: object | null;
  /** Callback when value is edited (only when readOnly is false) */
  onChange?: (value: JsonValue) => void;
  /** Whether to prevent editing. Defaults to true for safety. */
  readOnly?: boolean;
  /** Height of the editor. Defaults to 500px. */
  height?: string | number;
  /** Width of the editor. Defaults to 100%. */
  width?: string | number;
  /** Whether to show the tree sidebar. Defaults to true. */
  sidebarOpen?: boolean;
}

/**
 * Reusable visual JSON viewer/editor powered by @visual-json/react.
 * Provides an interactive tree + form view with schema awareness.
 *
 * Usage:
 * ```tsx
 * <VisualJsonViewer value={jobData} schema={jobJsonSchema} />
 * ```
 */
export function VisualJsonViewer({
  value,
  schema = null,
  onChange,
  readOnly = true,
  height = 500,
  width = "100%",
  sidebarOpen = true,
}: VisualJsonViewerProps) {
  return (
    <JsonEditor
      value={value as JsonValue}
      onChange={onChange}
      schema={schema}
      readOnly={readOnly}
      height={height}
      width={width}
      sidebarOpen={sidebarOpen}
      treeShowValues
      treeShowCounts
      editorShowDescriptions
      editorShowCounts
    />
  );
}
