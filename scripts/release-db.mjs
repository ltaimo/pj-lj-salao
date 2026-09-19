import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
const db = new PrismaClient();
const action = process.argv[2] ?? 'inspect';
try {
  if (action === 'inspect') {
    const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    console.log(JSON.stringify({tables: tables.map(t=>t.tablename), organizations: await db.organization.count(), migrations: tables.some(t=>t.tablename==='_prisma_migrations') ? await db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at` : []}));
  } else if (action === 'readiness') {
    const users=await db.user.findMany({where:{status:'ACTIVE',deletedAt:null},select:{id:true,email:true,passwordHash:true}});
    const weak=[];
    for(const user of users) if(await argon2.verify(user.passwordHash,'change-me-before-production')) weak.push({id:user.id,email:user.email});
    const settings=await db.setting.findMany({where:{key:'business.profile'},select:{organizationId:true,branchId:true,value:true}});
    console.log(JSON.stringify({defaultPasswordAccounts:weak, businessSettings:settings.map(s=>({organizationId:s.organizationId,branchId:s.branchId,receiptFormat:s.value?.receiptFormat,paymentMethods:s.value?.paymentMethods,keys:Object.keys(s.value??{})}))}));
  } else if (action === 'secure-defaults') {
    mkdirSync('.audit',{recursive:true});
    const file='.audit/production-access.json';
    const access=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
    const users=await db.user.findMany({where:{status:'ACTIVE',deletedAt:null,email:{in:['admin@pjlj.local','agente007@pjlj.local']}}});
    for(const user of users) {
      if(!await argon2.verify(user.passwordHash,'change-me-before-production'))continue;
      const password=randomBytes(24).toString('base64url');
      // Persist the replacement securely in the ignored local handoff before updating the account.
      access.push({email:user.email,password});writeFileSync(file,JSON.stringify(access,null,2));
      await db.user.update({where:{id:user.id},data:{passwordHash:await argon2.hash(password),refreshTokenHash:null}});
      await db.auditLog.create({data:{organizationId:user.organizationId,branchId:user.branchId,action:'SECURE_DEFAULT_PASSWORD',entity:'users',entityId:user.id}});
      console.log('Default password replaced:',user.email);
    }
    console.log('Local access file:',file);
  } else if (action === 'test-account') {
    const orgId = '00000000-0000-4000-8000-000000000099';
    const org = await db.organization.upsert({where:{id:orgId},update:{},create:{id:orgId,name:'PJ&LJ · Ambiente de testes',currency:'MZN',timezone:'Africa/Maputo',language:'pt'}});
    const branch = await db.branch.upsert({where:{organizationId_code:{organizationId:org.id,code:'QA'}},update:{},create:{organizationId:org.id,code:'QA',name:'Testes · Sem operação comercial'}});
    mkdirSync('.audit',{recursive:true});
    const credentials = existsSync('.audit/test-access.json') ? JSON.parse(readFileSync('.audit/test-access.json','utf8')) : {email:'teste@pjlj.local',password:randomBytes(24).toString('base64url')};
    const role=await db.role.findUniqueOrThrow({where:{key:'super_admin'}});
    const user=await db.user.upsert({where:{email:credentials.email},update:{organizationId:org.id,branchId:branch.id,status:'ACTIVE',deletedAt:null,passwordHash:await argon2.hash(credentials.password)},create:{email:credentials.email,name:'Operador de testes',organizationId:org.id,branchId:branch.id,passwordHash:await argon2.hash(credentials.password)}});
    await db.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:role.id}},update:{},create:{userId:user.id,roleId:role.id}});
    writeFileSync('.audit/test-access.json',JSON.stringify({...credentials,organizationId:org.id,branchId:branch.id},null,2));
    console.log(JSON.stringify({testUser:credentials.email,organization:org.name,credentialsFile:'.audit/test-access.json'}));
  }
} catch (error) {console.error('Database operation failed:',error.code ?? error.name); process.exitCode=1;}
finally {await db.$disconnect();}
