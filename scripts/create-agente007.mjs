import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function createAgente007() {
  console.log("🚀 Creating admin user Agente007...");
  
  const organization = await prisma.organization.findFirst();
  const branch = await prisma.branch.findFirst({where:{organizationId:organization?.id}});
  const adminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });

  if (!organization || !branch || !adminRole) {
    throw new Error("Organization, Branch, or super_admin Role missing from database.");
  }

  const email = "agente007@pjlj.local";
  const password = process.env.TEST_USER_PASSWORD;
  if (!password || password.length < 12 || password === "change-me-before-production") throw new Error("Defina TEST_USER_PASSWORD com uma palavra-passe forte. Para testes isolados use scripts/release-db.mjs test-account.");
  const passwordHash = await argon2.hash(password);

  const agente007 = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Agente007",
      passwordHash,
      organizationId: organization.id,
      branchId: branch.id,
      status: "ACTIVE",
      deletedAt: null
    },
    create: {
      email,
      name: "Agente007",
      passwordHash,
      organizationId: organization.id,
      branchId: branch.id,
      status: "ACTIVE"
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: agente007.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: agente007.id,
      roleId: adminRole.id
    }
  });

  console.log(`✅ Admin user Agente007 created/updated successfully!`);
  console.log(`   ID: ${agente007.id}`);
  console.log(`   Email: ${agente007.email}`);
  console.log(`   Role: super_admin`);
}

createAgente007()
  .catch((err) => {
    console.error("❌ Failed to create Agente007:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
