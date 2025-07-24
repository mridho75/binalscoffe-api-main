// test-db-complete.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testAllTables() {
  console.log('🚀 Starting comprehensive database connection test...\n');
  
  const testResults = {
    connection: false,
    tables: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  try {
    // 1. Test basic connection
    console.log('1️⃣ Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');
    testResults.connection = true;

    // 2. Test raw query capability
    console.log('2️⃣ Testing raw query capability...');
    const dbInfo = await prisma.$queryRaw`SELECT DATABASE() as current_db, VERSION() as version`;
    console.log('✅ Raw query works:', dbInfo[0]);
    console.log('');

    // 3. List all tables in database
    console.log('3️⃣ Checking existing tables in database...');
    const existingTablesResult = await prisma.$queryRaw`SHOW TABLES`;
    const existingTables = existingTablesResult.map(t => Object.values(t)[0]);
    console.log('📋 Existing tables:', existingTables);
    console.log('');

    // Define all table tests
    const tableTests = [
      { name: 'Category', description: 'Product categories' },
      { name: 'Supplier', description: 'Product suppliers' },
      { name: 'Product', description: 'Products inventory' },
      { name: 'User', description: 'System users' },
      { name: 'Carts', description: 'Shopping carts' },
      { name: 'Orders', description: 'Customer orders' },
      { name: 'Orderdetail', description: 'Order line items' },
      { name: 'Purchase', description: 'Purchase orders' },
      { name: 'Purchasedetail', description: 'Purchase line items' },
      { name: 'Orderreturn', description: 'Order returns' },
      { name: 'Orderreturndetail', description: 'Order return line items' }
    ];

    console.log('4️⃣ Testing individual table access...\n');

    // Test each table
    for (const test of tableTests) {
      testResults.summary.total++;
      const modelAccessor = test.name.toLowerCase();

      try {
        console.log(`   Testing ${test.name} (${test.description})...`);

        // Check if the model exists on the Prisma client instance
        if (!prisma[modelAccessor]) {
          throw new Error(`Model '${test.name}' not found on Prisma Client. Check your schema and run 'prisma generate'.`);
        }

        // --- PERBAIKAN UTAMA DI SINI ---
        // Menggunakan metode .count() yang resmi, bukan $queryRaw dengan fungsi internal _getDmmf
        const recordCount = await prisma[modelAccessor].count();
        const sampleData = await prisma[modelAccessor].findMany({ take: 1 });

        console.log(`   ✅ ${test.name}: Accessible (${recordCount} records)`);
        testResults.tables[test.name] = {
          status: 'success',
          recordCount: recordCount,
          sampleData: sampleData.length > 0 ? 'Has data' : 'Empty table'
        };
        testResults.summary.passed++;
        
      } catch (error) {
        console.log(`   ❌ ${test.name}: Failed - ${error.message}`);
        testResults.tables[test.name] = {
          status: 'failed',
          error: error.message,
          code: error.code
        };
        testResults.summary.failed++;
      }
    }

    console.log('\n5️⃣ Testing table relationships...');
    
    // Test some key relationships
    const relationshipTests = [
      {
        name: 'Product -> Category',
        test: async () => {
          // PERBAIKAN: Menggunakan nama relasi camelCase 'category'
          const product = await prisma.product.findFirst({
            include: { kategory: true } 
          });
          return product ? 'Working' : 'No data to test';
        }
      },
      {
        name: 'Product -> Supplier',
        test: async () => {
          const product = await prisma.product.findFirst({
            include: { supplier: true }
          });
          return product ? 'Working' : 'No data to test';
        }
      },
      {
        name: 'Orders -> User',
        test: async () => {
          const order = await prisma.orders.findFirst({
            include: { user: true }
          });
          return order ? 'Working' : 'No data to test';
        }
      },
      {
        name: 'Orders -> Orderdetail',
        test: async () => {
          // PERBAIKAN: Menggunakan nama relasi camelCase 'orderDetails' (jika one-to-many)
          const order = await prisma.orders.findFirst({
            include: { Orderdetail: true } 
          });
          return order ? 'Working' : 'No data to test';
        }
      }
    ];

    for (const relTest of relationshipTests) {
      try {
        const result = await relTest.test();
        console.log(`   ✅ ${relTest.name}: ${result}`);
      } catch (error) {
        console.log(`   ❌ ${relTest.name}: Failed - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Database connection or initial test failed:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n📊 Test Summary:');
    console.log(`   Database Connection: ${testResults.connection ? '✅' : '❌'}`);
    console.log(`   Total Tables Tested: ${testResults.summary.total}`);
    console.log(`   Passed: ${testResults.summary.passed}`);
    console.log(`   Failed: ${testResults.summary.failed}`);
    
    if (testResults.summary.failed > 0) {
      console.log('\n🔍 Failed Tables Details:');
      Object.entries(testResults.tables).forEach(([tableName, result]) => {
        if (result.status === 'failed') {
          console.log(`   ❌ ${tableName}: ${result.error} (Code: ${result.code || 'N/A'})`);
        }
      });
    }

    console.log('\n🏁 Database test completed!');
    
    // Return results for programmatic use
    return testResults;
  }
}

// Run the test
testAllTables()
  .then((results) => {
    process.exit(results.summary.failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });