export interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
  /** Set for inline images referenced in HTML as `cid:<contentId>`. */
  contentId?: string;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<{ id?: string }>;
}
