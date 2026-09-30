import "dotenv/config";

export class AssemblyAIService {
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "ASSEMBLYAI_API_KEY is not configured"
      );
    }

    this.apiKey = apiKey;
  }

  async createTemporaryToken(): Promise<string> {
    const url = new URL(
      "https://agents.assemblyai.com/v1/token"
    );

    url.searchParams.set(
      "expires_in_seconds",
      "300"
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Failed to create AssemblyAI token: ${response.status} ${errorText}`
      );
    }

    const data = (await response.json()) as {
      token?: string;
    };

    if (!data.token) {
      throw new Error(
        "AssemblyAI did not return a temporary token"
      );
    }

    return data.token;
  }
}