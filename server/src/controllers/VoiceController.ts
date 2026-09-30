import { Request, Response } from "express";
import { AssemblyAIService } from "../services/AssemblyAIService";

export class VoiceController {
  constructor(
    private readonly assemblyAIService: AssemblyAIService
  ) {}

  getTemporaryToken = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const token =
        await this.assemblyAIService
          .createTemporaryToken();

      res.status(200).json({
        success: true,
        data: {
          token,
        },
      });
    } catch (error) {
      console.error(
        "Failed to create AssemblyAI token:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to create AssemblyAI voice token",
      });
    }
  };
}