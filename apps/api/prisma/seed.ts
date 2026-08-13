import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "../../../packages/shared/src";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "PJ&LJ Salao Unissex",
      currency: "MZN",
      timezone: "Africa/Maputo",
      language: "pt"
    }
  });

  const branch = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "MAIN"
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Filial Principal",
      code: "MAIN"
    }
  });

  await Promise.all(
    PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission },
        update: {},
        create: { key: permission, description: permission }
      })
    )
  );

  const adminRole = await prisma.role.upsert({
    where: { key: "super_admin" },
    update: {},
    create: {
      key: "super_admin",
      name: "Super Administrator",
      system: true,
      description: "Controlo total do sistema"
    }
  });

  const permissions = await prisma.permission.findMany();
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      })
    )
  );

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@pjlj.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me-before-production";
  const passwordHash = await argon2.hash(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      organizationId: organization.id,
      branchId: branch.id,
      status: "ACTIVE"
    },
    create: {
      email,
      name: "Administrador PJ&LJ",
      passwordHash,
      organizationId: organization.id,
      branchId: branch.id,
      status: "ACTIVE"
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id
    }
  });

  await prisma.setting.upsert({
    where: {
      organizationId_branchId_key: {
        organizationId: organization.id,
        branchId: branch.id,
        key: "business.profile"
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      branchId: branch.id,
      key: "business.profile",
      value: {
        receiptFormat: "80mm",
        decimalPlaces: 2,
        paymentMethods: ["Numerario", "M-Pesa", "e-Mola", "Cartao/POS", "Transferencia Bancaria"]
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      userId: admin.id,
      action: "SEED",
      entity: "foundation",
      entityId: organization.id,
      after: { adminEmail: email }
    }
  });

  console.log(`Seed complete. Admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
