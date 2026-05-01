// Clerk除去済み — DEV_CLERK_USER_ID を常に使用
export async function auth(): Promise<{ userId: string | null; orgId: string | null }> {
  return {
    userId: process.env.DEV_CLERK_USER_ID ?? null,
    orgId: null,
  }
}
