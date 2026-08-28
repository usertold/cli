import * as Api from '../api-types';
import {
  ApiIntakeCreateResponseSchema,
  ApiIntakeDetailResponseSchema,
  ApiIntakeQuestionResponseSchema,
  ApiIntakeQuestionsReorderResponseSchema,
  ApiIntakeResponseDetailResponseSchema,
  ApiIntakeResponseMutationResponseSchema,
  ApiIntakeResponseWrapperSchema,
  ApiIntakesListResponseSchema,
  ApiSuccessResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const intakesApiContracts = {
  intakesList: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiIntakesListResponseSchema,
  }),
  intakeCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiIntakeCreateRequestSchema,
    response: ApiIntakeCreateResponseSchema,
  }),
  intakeGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef'],
    response: ApiIntakeDetailResponseSchema,
  }),
  intakeQuestionCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/questions',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef'],
    body: Api.ApiIntakeQuestionCreateRequestSchema,
    response: ApiIntakeQuestionResponseSchema,
  }),
  intakeQuestionPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/questions/:questionId',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef', 'questionId'],
    body: Api.ApiIntakeQuestionPatchRequestSchema,
    response: ApiIntakeQuestionResponseSchema,
  }),
  intakeQuestionReorder: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/questions/reorder',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef'],
    body: Api.ApiIntakeQuestionReorderRequestSchema,
    response: ApiIntakeQuestionsReorderResponseSchema,
  }),
  intakeQuestionDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/questions/:questionId',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef', 'questionId'],
    response: ApiSuccessResponseSchema,
  }),
  intakeSetQuestions: defineContract({
    method: 'PUT',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/questions',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef'],
    body: Api.ApiIntakeSetQuestionsRequestSchema,
    response: ApiIntakeQuestionsReorderResponseSchema,
  }),
  intakePatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef'],
    body: Api.ApiIntakePatchRequestSchema,
    response: ApiIntakeResponseWrapperSchema,
  }),
  intakeDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef'],
    response: ApiSuccessResponseSchema,
  }),
  intakeResponseGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/responses/:responseId',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef', 'responseId'],
    response: ApiIntakeResponseDetailResponseSchema,
  }),
  intakeResponsePatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/intakes/:intakeRef/responses/:responseId',
    pathParams: ['orgHandle', 'projectHandle', 'intakeRef', 'responseId'],
    body: Api.ApiIntakeResponsePatchRequestSchema,
    response: ApiIntakeResponseMutationResponseSchema,
  }),
} as const;
