import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "./env";

const sesConfig =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        region: env.AWS_REGION,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : { region: env.AWS_REGION };

export const sesClient = new SESv2Client(sesConfig);

export interface SendAppEmailInput {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendAppEmail(input: SendAppEmailInput): Promise<string | undefined> {
  const command = new SendEmailCommand({
    FromEmailAddress: input.from,
    Destination: { ToAddresses: input.to },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          ...(input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {}),
        },
      },
    },
    ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
    ConfigurationSetName: env.SES_CONFIGURATION_SET || undefined,
  });

  const response = await sesClient.send(command);
  return response.MessageId;
}
