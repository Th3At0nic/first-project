import { Router } from 'express';
import { AcademicFacultyControllers } from './academicFaculty.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { AcademicFacultyValidation } from './academicFaculty.validation';

const router = Router();

router.post(
  '/create-academic-faculty',
  validateRequest(AcademicFacultyValidation),
  AcademicFacultyControllers.createAcademicFaculty,
);

export const AcademicFacultyRoute = router;