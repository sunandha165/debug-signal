import { Router } from "express";
import { InvestigationController } from "../controllers/InvestigationController";

export const createInvestigationRoutes = (
  investigationController: InvestigationController
) => {
  const router = Router();

  router.post(
    "/investigate",
    investigationController.investigate
  );

  return router;
};