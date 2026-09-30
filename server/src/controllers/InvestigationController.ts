import { Request, Response } from "express";
import { InvestigationService } from "../services/InvestigationService";

export class InvestigationController {
  constructor(
    private readonly investigationService: InvestigationService
  ) {}

  investigate = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { query } = req.body;

      if (
        typeof query !== "string" ||
        !query.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Investigation query is required",
        });

        return;
      }

      const result =
        await this.investigationService.investigate(
          query
        );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "Investigation failed:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Investigation failed",
      });
    }
  };
}