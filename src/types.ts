import { z } from 'zod'

export const orderStatusSchema = z.enum(['accepted', 'allocated', 'picking', 'picked', 'packed', 'shipped', 'returned'])

export const demoRoleSchema = z.enum(['picker', 'packer', 'warehouse_manager'])

export const demoProfileSchema = z.object({
  id: z.string().min(1),
  role: demoRoleSchema,
})

export const fulfillmentActionSchema = z.enum(['allocate', 'pick', 'pack', 'ship', 'return'])

export const returnReasonSchema = z.enum(['damaged', 'wrong_item', 'customer_changed_mind'])

const orderItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  location: z.string(),
  orderedQuantity: z.number().int(),
  pickedQuantity: z.number().int(),
})

const orderEventSchema = z.object({
  event: z.string(),
  label: z.string(),
  at: z.string(),
  actorRole: z.union([demoRoleSchema, z.literal('system')]),
})

export const fulfillmentOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: orderStatusSchema,
  priority: z.enum(['expedite', 'high', 'standard']),
  channel: z.enum(['direct', 'marketplace', 'store_transfer']),
  zone: z.string(),
  promisedAt: z.string(),
  createdAt: z.string(),
  items: z.array(orderItemSchema),
  allocation: z.object({ reference: z.string(), allocatedAt: z.string() }).nullable(),
  package: z.object({ id: z.string(), packedAt: z.string() }).nullable(),
  shipment: z
    .object({
      carrier: z.literal('ParcelPilot'),
      trackingNumber: z.string(),
      shippedAt: z.string(),
    })
    .nullable(),
  returnInfo: z.object({ reason: returnReasonSchema, createdAt: z.string() }).nullable(),
  events: z.array(orderEventSchema),
  version: z.number().int(),
})

export const workflowSummarySchema = z.object({
  openOrders: z.number().int(),
  readyToPick: z.number().int(),
  packedToday: z.number().int(),
  slaAtRisk: z.number().int(),
})

export const workflowResultSchema = z.object({
  order: fulfillmentOrderSchema,
  message: z.string(),
  replayed: z.boolean(),
})

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  details: z.array(z.string()).optional(),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type DemoRole = z.infer<typeof demoRoleSchema>
export type DemoProfile = z.infer<typeof demoProfileSchema>
export type FulfillmentAction = z.infer<typeof fulfillmentActionSchema>
export type ReturnReason = z.infer<typeof returnReasonSchema>
export type FulfillmentOrder = z.infer<typeof fulfillmentOrderSchema>
export type WorkflowSummary = z.infer<typeof workflowSummarySchema>
export type WorkflowResult = z.infer<typeof workflowResultSchema>
