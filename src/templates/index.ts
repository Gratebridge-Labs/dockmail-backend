import { baseTemplate, stripHtmlToText } from "./system/base.template";
import { buildSystemTemplate, SystemEmailTemplate, TemplateVariables } from "./system/emails";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface RenderOptions {
  subject: string;
  content: string;
  unsubscribeText?: string;
}

export function renderEmail(options: RenderOptions): { html: string; text: string } {
  const html = baseTemplate(options);
  return { html, text: stripHtmlToText(html) };
}

export function renderSystemTemplate(name: SystemEmailTemplate, variables: TemplateVariables): EmailTemplate {
  const built = buildSystemTemplate(name, variables);
  const rendered = renderEmail({
    subject: built.subject,
    content: built.content,
    unsubscribeText: built.unsubscribeText,
  });
  return {
    subject: built.subject,
    html: rendered.html,
    text: rendered.text,
  };
}

export type { SystemEmailTemplate, TemplateVariables };
