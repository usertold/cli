import { z } from 'zod';

export const ApiIntakeSchema = z.object({
  ref: z.string(),
  project_ref: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  handle: z.string(),
  status: z.string(),
  auto_managed: z.number(),
  max_participants: z.number().nullable(),
  logo_r2_key: z.string().nullable(),
  brand_color: z.string(),
  welcome_message: z.string().nullable(),
  thank_you_message: z.string(),
  disqualified_message: z.string(),
  consent_text: z.string(),
  complete_count: z.number(),
  qualified_count: z.number(),
  disqualified_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiIntake = z.infer<typeof ApiIntakeSchema>;

export const ApiIntakeQuestionSchema = z.object({
  id: z.string(),
  question_text: z.string(),
  question_type: z.string(),
  required: z.number(),
  sort_order: z.number(),
  options_json: z.string().nullable(),
  min_value: z.number().nullable(),
  max_value: z.number().nullable(),
  qualification_rules_json: z.string().nullable(),
  created_at: z.string(),
});
export type ApiIntakeQuestion = z.infer<typeof ApiIntakeQuestionSchema>;

export const ApiIntakeResponseSchema = z.object({
  id: z.string(),
  participant_name: z.string().nullable(),
  participant_email: z.string().nullable(),
  qualified: z.number().nullable(),
  qualification_reason: z.string().nullable(),
  answers_json: z.string(),
  session_id: z.string().nullable(),
  utm_source: z.string().nullable(),
  utm_medium: z.string().nullable(),
  utm_campaign: z.string().nullable(),
  consent_given: z.number(),
  created_at: z.string(),
});
export type ApiIntakeResponse = z.infer<typeof ApiIntakeResponseSchema>;

export const ApiIntakeResponseDetailSchema = ApiIntakeResponseSchema.extend({
  answers: z.unknown().nullable(),
});
export type ApiIntakeResponseDetail = z.infer<typeof ApiIntakeResponseDetailSchema>;

export const ApiIntakesListResponseSchema = z.object({
  intakes: z.array(ApiIntakeSchema),
}).meta({ id: 'ApiIntakesListResponse' });
export type ApiIntakesListResponse = z.infer<typeof ApiIntakesListResponseSchema>;

export const ApiIntakeDetailResponseSchema = z.object({
  intake: ApiIntakeSchema,
  questions: z.array(ApiIntakeQuestionSchema),
  responses: z.array(ApiIntakeResponseSchema),
}).meta({ id: 'ApiIntakeDetailResponse' });
export type ApiIntakeDetailResponse = z.infer<typeof ApiIntakeDetailResponseSchema>;

export const ApiIntakeResponseWrapperSchema = z.object({
  intake: ApiIntakeSchema,
}).meta({ id: 'ApiIntakeResponseWrapper' });
export type ApiIntakeResponseWrapper = z.infer<typeof ApiIntakeResponseWrapperSchema>;

export const ApiIntakeCreateResponseSchema = z.object({
  intake: ApiIntakeSchema,
  questions: z.array(ApiIntakeQuestionSchema),
}).meta({ id: 'ApiIntakeCreateResponse' });
export type ApiIntakeCreateResponse = z.infer<typeof ApiIntakeCreateResponseSchema>;

export const ApiIntakeQuestionResponseSchema = z.object({
  question: ApiIntakeQuestionSchema,
}).meta({ id: 'ApiIntakeQuestionResponse' });
export type ApiIntakeQuestionResponse = z.infer<typeof ApiIntakeQuestionResponseSchema>;

export const ApiIntakeQuestionsReorderResponseSchema = z.object({
  questions: z.array(ApiIntakeQuestionSchema),
}).meta({ id: 'ApiIntakeQuestionsReorderResponse' });
export type ApiIntakeQuestionsReorderResponse = z.infer<typeof ApiIntakeQuestionsReorderResponseSchema>;

export const ApiIntakeResponseDetailResponseSchema = z.object({
  response: ApiIntakeResponseDetailSchema,
});
export type ApiIntakeResponseDetailResponse = z.infer<typeof ApiIntakeResponseDetailResponseSchema>;

export const ApiIntakeResponseMutationResponseSchema = z.object({
  response: ApiIntakeResponseSchema,
});
export type ApiIntakeResponseMutationResponse = z.infer<typeof ApiIntakeResponseMutationResponseSchema>;
