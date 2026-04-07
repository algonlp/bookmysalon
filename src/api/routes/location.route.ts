import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { locationController } from '../controllers/location.controller';

export const locationRouter = Router();

locationRouter.get('/public/locations/search', asyncHandler(locationController.search));
locationRouter.get('/public/locations/reverse', asyncHandler(locationController.reverse));
