export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<{ id?: string }>;
}
