import { PASSWORD_REQUIREMENTS } from "@/lib/cognito/password";

export interface PasswordRequirementsProps {
  id: string;
}

export function PasswordRequirements({ id }: PasswordRequirementsProps) {
  return (
    <p id={id} className="text-xs text-text-muted">
      {PASSWORD_REQUIREMENTS}
    </p>
  );
}
