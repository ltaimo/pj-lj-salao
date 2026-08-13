import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthService } from "../src/auth/auth.service";

describe("AuthService", () => {
  it("rejects invalid credentials", async () => {
    const service = new AuthService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue(null)
        }
      } as never,
      new JwtService(),
      { record: jest.fn() } as never
    );

    await expect(service.login({ email: "nobody@example.com", password: "password123" })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("logs in and writes an audit entry", async () => {
    const passwordHash = await argon2.hash("password123");
    const update = jest.fn().mockResolvedValue({});
    const record = jest.fn().mockResolvedValue({});
    const service = new AuthService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: "user-1",
            email: "admin@pjlj.local",
            name: "Admin",
            status: "ACTIVE",
            passwordHash,
            organizationId: "org-1",
            branchId: "branch-1"
          }),
          update
        }
      } as never,
      new JwtService(),
      { record } as never
    );

    const result = await service.login({ email: "admin@pjlj.local", password: "password123" });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(update).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGIN" }));
  });
});
