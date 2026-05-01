import { auth as clerkAuth } from '@clerk/nextjs/server'

// dev環境ではClerk認証をモック（DEV_CLERK_USER_IDに実際のClerk user IDを設定）
export async function auth(): Promise<{ userId: string | null; orgId: string | null }> {
  if (process.env.NODE_ENV === 'development') {
    return {
      userId: process.env.DEV_CLERK_USER_ID ?? null,
      orgId: null,
    }
  }
  const session = await clerkAuth()
  return { userId: session.userId, orgId: session.orgId ?? null }
}
