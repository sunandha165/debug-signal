import { Router } from "express";
import { VoiceController } from "../controllers/VoiceController";

export const createVoiceRoutes = (
  voiceController: VoiceController
) => {
  const router = Router();

  router.get(
    "/token",
    voiceController.getTemporaryToken
  );

  return router;
};