export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  mongoUri: process.env.MONGODB_URI ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT ?? "3000", 10),
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL ?? "",
  n8nWebhookUrlV2: process.env.N8N_WEBHOOK_URL_V2 ?? "",
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET ?? "",
};
