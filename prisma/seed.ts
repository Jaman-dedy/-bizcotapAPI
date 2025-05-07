import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  // STEP 1: Create SUPER ADMIN if not exists
  const adminEmail = 'info@bizcotap.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: await argon2.hash('bizcopay@1995?'),
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✅ Super admin created.');
  } else {
    console.log('ℹ️ Super admin already exists.');
  }

  // STEP 2: Seed tag data
  const dataPath = path.join(__dirname, 'sample_user_tags_api_format.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  for (const row of data) {
    try {
      const tagInfo = JSON.parse(row.tag_info);
      const userId = parseInt(row.user_id);

      // Extract first email from the user data
      const primaryEmail = tagInfo?.emails?.[0]?.value;
      
      if (!primaryEmail) {
        console.error(`❌ No email found for userId ${userId}`);
        continue;
      }

      // Ensure user exists
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            id: userId,
            email: primaryEmail,
            firstName: tagInfo.fname || 'First',
            lastName: tagInfo.lname || 'Last',
            password: null,
            isActive: true,
            role: 'INDIVIDUAL',
          },
        });
      }

      // Upsert UserTag
      await prisma.userTag.upsert({
        where: { tuid: row.tuid },
        update: {
          tagInfo,
          updatedAt: new Date(row.updated_at),
          isActive: true,
        },
        create: {
          tuid: row.tuid,
          tagInfo,
          isActive: true,
          userId,
          companyId: row.company_id ? parseInt(row.company_id) : null,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        },
      });

      console.log(`✅ Seeded tag for userId ${userId} (${tagInfo.fname} ${tagInfo.lname})`);
    } catch (err) {
      console.error(`❌ Failed for userId ${row.user_id}:`, err.message);
    }
  }
}

main()
  .catch((err) => {
    console.error('❌ Error during seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());