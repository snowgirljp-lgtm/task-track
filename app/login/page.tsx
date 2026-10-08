import LoginForm from "./LoginForm";

const ERRORS: Record<string, string> = {
  not_allowed: "Gmail นี้ยังไม่ได้ลงทะเบียน กรุณาติดต่อ Admin",
  suspended: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ Admin",
  auth: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm initialError={error ? ERRORS[error] ?? ERRORS.auth : null} />;
}
