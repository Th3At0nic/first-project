import mongoose from 'mongoose';
import { StudentModel } from './student.model';
import { UserModel } from '../user/user.model';
import { TStudent } from './student.interface';
import { NotFoundError } from '../../utils/errors/notFoundError';
import { ConflictError } from '../../utils/errors/conflictError';

const getAllStudentsFromDB = async (query: Record<string, unknown>) => {
  let searchTerm = '';
  if (query?.searchTerm) {
    searchTerm = query?.searchTerm as string;
  }

  const result = await StudentModel.find({
    $or: [
      'email',
      'name.firstName',
      'name.middleName',
      'name.lastName',
      'presentAddress',
      'permanentAddress',
      'contact',
    ].map((field) => ({
      [field]: { $regex: searchTerm, $options: 'i' },
    })),
    isDeleted: false,
  }).populate([
    'admissionSemester',
    {
      path: 'academicDepartment',
      populate: {
        path: 'academicFaculty',
      },
    },
  ]);

  if (!result.length) {
    throw new NotFoundError('No Student found.', [
      {
        path: 'Students',
        message: 'The student collection could not be found in the system.',
      },
    ]);
  }
  return result;
};

const getSingleStudentFromDB = async (id: string) => {
  const result = await StudentModel.findOne({ id, isDeleted: false }).populate([
    'admissionSemester',
    {
      path: 'academicDepartment',
      populate: {
        path: 'academicFaculty',
      },
    },
  ]);

  if (!result) {
    throw new NotFoundError(`Student not found!`, [
      {
        path: `${id}`,
        message: `No student found with the provided ID: ${id}. Please check the ID and try again.`,
      },
    ]);
  }

  // const result = await StudentModel.aggregate([{ $match: { id: id } }]);

  // this job can be done with both findOne and aggregate, so commented out any one!. remember, each process needs dedicated code block in the model (mongoose middleware)
  return result;
};

const deleteStudentFromDB = async (id: string) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const student = await StudentModel.findOne({
      id: id,
      isDeleted: false,
    });

    if (!student) {
      throw new NotFoundError(`Student not found!`, [
        {
          path: `${id}`,
          message: `No student found with the provided ID: ${id}. Please check the ID and try again.`,
        },
      ]);
    }

    await UserModel.findOneAndUpdate(
      { id },
      { isDeleted: true },
      {
        new: true,
        session,
      },
    );

    const result = await StudentModel.findOneAndUpdate(
      { id },
      { isDeleted: true },
      { new: true, session },
    );

    await session.commitTransaction();

    return result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    await session.abortTransaction();
    if (err.code === 1100) {
      throw new ConflictError('Duplicate Error', [
        { path: 'Delete', message: 'Duplicate Error' },
      ]);
    }
    throw new ConflictError('Failed to delete the student.', [
      {
        path: 'transaction',
        message:
          'Failed to process the transaction due to a conflict. Please try again.',
      },
    ]);
  } finally {
    session.endSession();
  }
};

const updateStudentIntoDB = async (
  id: string,
  updatedData: Partial<TStudent>,
) => {
  const student = await StudentModel.findOne({ id });
  if (!student || student.isDeleted) {
    throw new NotFoundError(`Student not found!`, [
      {
        path: `${id}`,
        message: `No student found with the provided ID: ${id}. Please check the ID and try again.`,
      },
    ]);
  }

  const { name, guardian, localGuardian, ...remainingData } = updatedData;

  const flattenedData: Record<string, unknown> = { ...remainingData };

  if (name && Object.keys(name).length) {
    for (const [key, value] of Object.entries(name)) {
      flattenedData[`name.${key}`] = value;
    }
  }

  if (guardian && Object.keys(guardian).length) {
    for (const [key, value] of Object.entries(guardian)) {
      flattenedData[`guardian.${key}`] = value;
    }
  }

  if (localGuardian && Object.keys(localGuardian).length) {
    for (const [key, value] of Object.entries(localGuardian)) {
      flattenedData[`localGuardian.${key}`] = value;
    }
  }

  const result = await StudentModel.findOneAndUpdate({ id }, flattenedData, {
    new: true,
    runValidators: true,
  });
  return result;
};

export const studentService = {
  getAllStudentsFromDB,
  getSingleStudentFromDB,
  deleteStudentFromDB,
  updateStudentIntoDB,
};
