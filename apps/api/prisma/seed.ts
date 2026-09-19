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

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission },
      update: {},
      create: { key: permission, description: permission }
    });
  }

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

  const cashierRole = await prisma.role.upsert({
    where: { key: "cashier" },
    update: {},
    create: {
      key: "cashier",
      name: "Caixa",
      system: true,
      description: "Opera caixa, pagamentos e recibos"
    }
  });

  const receptionistRole = await prisma.role.upsert({
    where: { key: "receptionist" },
    update: {},
    create: {
      key: "receptionist",
      name: "Rececionista",
      system: true,
      description: "Clientes, fila, marcacoes e POS"
    }
  });

  const permissions = await prisma.permission.findMany();
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
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
    });
  }

  const rolePermissionKeys = {
    cashier: ["dashboard.view", "sales.create", "cash.open", "cash.close", "cash.adjust", "inventory.view", "reports.sales"],
    receptionist: [
      "dashboard.view",
      "clients.create",
      "clients.edit",
      "appointments.create",
      "appointments.edit",
      "queue.manage",
      "sales.create",
      "inventory.view"
    ]
  };
  for (const [roleKey, keys] of Object.entries(rolePermissionKeys)) {
    const role = roleKey === "cashier" ? cashierRole : receptionistRole;
    for (const key of keys) {
      const permission = permissions.find((item) => item.key === key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@pjlj.local";
  const existingAdmin = await prisma.user.findUnique({where:{email}});
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!existingAdmin && (!password || password.length < 12 || password === "change-me-before-production")) throw new Error("Defina SEED_ADMIN_PASSWORD com uma palavra-passe forte antes de criar o administrador.");
  const passwordHash = existingAdmin?.passwordHash ?? await argon2.hash(password!);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
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

  const genericClient = await prisma.client.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "CLI-00000" } },
    update: {},
    create: {
      organizationId: organization.id,
      branchId: branch.id,
      code: "CLI-00000",
      firstName: "Consumidor Final",
      source: "Walk-in"
    }
  });

  for (const [index, client] of [
    { firstName: "Maria", lastName: "Mabunda", phone: "+258 84 111 2200", source: "WhatsApp" },
    { firstName: "Joao", lastName: "Chissano", phone: "+258 86 220 1100", source: "Walk-in" },
    { firstName: "Celeste", lastName: "Matsinhe", phone: "+258 82 300 4400", source: "Indicacao" }
  ].entries()) {
    await prisma.client.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: `CLI-${String(index + 1).padStart(5, "0")}` } },
      update: {},
      create: {
        organizationId: organization.id,
        branchId: branch.id,
        code: `CLI-${String(index + 1).padStart(5, "0")}`,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        whatsapp: client.phone,
        source: client.source
      }
    });
  }

  const employees = [
    { code: "EMP-00001", name: "Daisy", role: "Cabeleireiro", specialty: "Tratamentos e brushing", commissionRate: 30 },
    { code: "EMP-00002", name: "Laura", role: "Cabeleireiro", specialty: "Trancas e extensoes", commissionRate: 35 },
    { code: "EMP-00003", name: "Paulo", role: "Barbeiro", specialty: "Corte e barba", commissionRate: 30 }
  ];
  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: employee.code } },
      update: { active: true },
      create: { organizationId: organization.id, branchId: branch.id, ...employee }
    });
  }

  const serviceCategories = {
    Barbearia: await prisma.serviceCategory.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Barbearia" } },
      update: {},
      create: { organizationId: organization.id, branchId: branch.id, name: "Barbearia" }
    }),
    Cabeleireiro: await prisma.serviceCategory.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Cabeleireiro" } },
      update: {},
      create: { organizationId: organization.id, branchId: branch.id, name: "Cabeleireiro" }
    })
  };

  for (const service of [
    { categoryId: serviceCategories.Barbearia.id, name: "Corte masculino", durationMinutes: 30, price: 500, cost: 80 },
    { categoryId: serviceCategories.Barbearia.id, name: "Corte infantil", durationMinutes: 25, price: 350, cost: 60 },
    { categoryId: serviceCategories.Barbearia.id, name: "Corte maquina", durationMinutes: 20, price: 300, cost: 40 },
    { categoryId: serviceCategories.Barbearia.id, name: "Barba completa", durationMinutes: 25, price: 300, cost: 40 },
    { categoryId: serviceCategories.Barbearia.id, name: "Alinhamento de barba", durationMinutes: 15, price: 200, cost: 25 },
    { categoryId: serviceCategories.Barbearia.id, name: "Desenho / risco", durationMinutes: 15, price: 150, cost: 20 },
    { categoryId: serviceCategories.Barbearia.id, name: "Lavagem masculina", durationMinutes: 15, price: 200, cost: 40 },
    { categoryId: serviceCategories.Barbearia.id, name: "Tratamento capilar masculino", durationMinutes: 45, price: 900, cost: 220 },
    { categoryId: serviceCategories.Barbearia.id, name: "Corte + Barba", durationMinutes: 50, price: 750, cost: 120 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Lavagem", durationMinutes: 20, price: 250, cost: 50 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Brushing", durationMinutes: 45, price: 650, cost: 100 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Corte feminino", durationMinutes: 45, price: 750, cost: 100 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Penteado", durationMinutes: 60, price: 1200, cost: 180 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Trancas", durationMinutes: 180, price: 2500, cost: 450 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Extensoes", durationMinutes: 150, price: 2200, cost: 420 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Relaxamento", durationMinutes: 90, price: 1500, cost: 380 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Hidratacao profunda", durationMinutes: 60, price: 950, cost: 260 },
    { categoryId: serviceCategories.Cabeleireiro.id, name: "Coloracao", durationMinutes: 120, price: 1800, cost: 600 }
  ]) {
    await prisma.service.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: service.name } },
      update: { active: true, price: service.price, cost: service.cost },
      create: { organizationId: organization.id, branchId: branch.id, description: service.name, allowWalkIn: true, ...service }
    });
  }

  const productCategory = await prisma.productCategory.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Cosmeticos" } },
    update: {},
    create: { organizationId: organization.id, branchId: branch.id, name: "Cosmeticos" }
  });
  for (const product of [
    { sku: "PRD-00001", name: "Champo Hidratante", brand: "PJ&LJ", purchasePrice: 220, salePrice: 450, stock: 18, minimumStock: 5, unit: "unidade" },
    { sku: "PRD-00002", name: "Oleo para barba", brand: "PJ&LJ", purchasePrice: 180, salePrice: 350, stock: 12, minimumStock: 4, unit: "unidade" },
    { sku: "PRD-00003", name: "Gel fixador", brand: "PJ&LJ", purchasePrice: 120, salePrice: 280, stock: 3, minimumStock: 5, unit: "unidade" },
    { sku: "PRD-00004", name: "Tinta castanho", brand: "Salon Pro", purchasePrice: 300, salePrice: 700, stock: 9, minimumStock: 3, unit: "embalagem" }
  ]) {
    const created = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: organization.id, sku: product.sku } },
      update: { active: true, salePrice: product.salePrice, stock: product.stock, minimumStock: product.minimumStock },
      create: { organizationId: organization.id, branchId: branch.id, categoryId: productCategory.id, ...product }
    });
    const movementCount = await prisma.stockMovement.count({ where: { productId: created.id, type: "OPENING" } });
    if (movementCount === 0) {
      await prisma.stockMovement.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          productId: created.id,
          type: "OPENING",
          quantity: product.stock,
          beforeQuantity: 0,
          afterQuantity: product.stock,
          reason: "Seed de demonstracao",
          userId: admin.id
        }
      });
    }
  }

  const corte = await prisma.service.findFirst({ where: { organizationId: organization.id, name: "Corte masculino" } });
  const paulo = await prisma.employee.findFirst({ where: { organizationId: organization.id, code: "EMP-00003" } });
  if (corte && paulo) {
    const queueCount = await prisma.queueEntry.count({ where: { organizationId: organization.id, branchId: branch.id } });
    if (queueCount === 0) {
      await prisma.queueEntry.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          clientId: genericClient.id,
          serviceId: corte.id,
          employeeId: paulo.id,
          customerName: "Consumidor Final",
          notes: "Walk-in de demonstracao"
        }
      });
    }
  }

  await prisma.cashSession.upsert({
    where: { id: "00000000-0000-4000-8000-000000000101" },
    update: { status: "OPEN" },
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: organization.id,
      branchId: branch.id,
      openedById: admin.id,
      terminal: "MAIN",
      openingBalance: 1000,
      expectedBalance: 1000
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
