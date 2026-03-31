<?php
/**
 * ACCOUNTING SYSTEM - DATABASE RESTORE (PHP VERSION 3.0 - MULTI-PASS)
 * Robust restoration that handles self-references (User.managerId, Account.parentId)
 * without needing superuser privileges.
 */

// --- CONFIGURATION ---
$db_host = 'localhost';
$db_port = '5432';
$db_name = 'orgajyzd_accabiz';
$db_user = 'orgajyzd_ashraful';
$db_pass = 'alinairin#7679';

$backup_file = __DIR__ . '/../backup.json';

$MODELS = [
    'Currency', 'AccountType', 'User', 'Role', 'UserRole', 'UserPermission',
    'Company', 'UserCompany', 'CompanySettings', 'Account', 'Branch',
    'Project', 'CostCenter', 'Customer', 'Vendor', 'Product', 'Employee',
    'LC', 'PI', 'PILine', 'PurchaseOrder', 'PurchaseOrderLine', 'Invoice',
    'InvoiceLine', 'JournalEntry', 'JournalEntryLine', 'Bill', 'Payment',
    'PaymentPI', 'Attachment', 'ActivityLog', 'Notification',
    'EmployeeAdvance', 'EmployeeLoan', 'EmployeeLoanRepayment', 'EmployeeExpense'
];

// Self-referencing columns to handle in a final pass
$SELF_REFS = [
    'User' => ['managerId'],
    'Account' => ['parentId']
];

echo "🎯 Starting Database Restore (PHP Version 3.0)...\n";

if (!file_exists($backup_file)) {
    die("❌ Error: backup.json not found.\n");
}

try {
    $dsn = "pgsql:host=$db_host;port=$db_port;dbname=$db_name";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "✅ Connected to Namecheap PostgreSQL.\n";

    $all_data = json_decode(file_get_contents($backup_file), true);
    if (!$all_data)
        die("❌ Error: Invalid backup.json\n");

    // 1. WIPE TARGET (Reverse)
    echo "\n🧹 Wiping target database...\n";
    foreach (array_reverse($MODELS) as $model) {
        echo "   - Clearing $model...\n";
        try {
            $pdo->exec("DELETE FROM \"$model\"");
        }
        catch (Exception $e) {
            echo "     ⚠️ Warning clearing $model: " . $e->getMessage() . "\n";
        }
    }

    // Stores update statements for the final pass
    $update_queue = [];

    // 2. RESTORE DATA (Forward)
    echo "\n📦 Restoring data (Pass 1: Insertions)...\n";
    foreach ($MODELS as $model) {
        $data = isset($all_data[$model]) ? $all_data[$model] : [];
        $count = count($data);
        if ($count === 0)
            continue;

        echo "   - Writing $model... ($count records)\n";

        $columns = array_keys($data[0]);
        $col_string = '"' . implode('", "', $columns) . '"';
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $stmt = $pdo->prepare("INSERT INTO \"$model\" ($col_string) VALUES ($placeholders)");

        foreach ($data as $row) {
            $values = [];
            foreach ($columns as $col) {
                $val = isset($row[$col]) ? $row[$col] : null;

                // Handle Self-References: Store for Pass 2 and use NULL for now
                if (isset($SELF_REFS[$model]) && in_array($col, $SELF_REFS[$model]) && !empty($val)) {
                    $update_queue[] = [
                        'table' => $model,
                        'column' => $col,
                        'id' => $row['id'],
                        'value' => $val
                    ];
                    $val = null;
                }

                if ($val === null)
                    $values[] = null;
                elseif (is_bool($val))
                    $values[] = $val ? 'true' : 'false';
                elseif (is_array($val))
                    $values[] = json_encode($val);
                else
                    $values[] = $val;
            }

            try {
                $stmt->execute($values);
            }
            catch (Exception $e) {
                echo "     ⚠️ Row Error in $model (Pass 1): " . $e->getMessage() . "\n";
            }
        }
    }

    // 3. UPDATE SELF-REFERENCES (Pass 2)
    echo "\n📎 Restoring self-links (Pass 2: Updates)...\n";
    $update_count = count($update_queue);
    echo "   - Processing $update_count updates...\n";

    foreach ($update_queue as $item) {
        try {
            $table = $item['table'];
            $col = $item['column'];
            $sql = "UPDATE \"$table\" SET \"$col\" = ? WHERE \"id\" = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$item['value'], $item['id']]);
        }
        catch (Exception $e) {
            echo "     ⚠️ Update Error in {$item['table']}.{$item['column']}: " . $e->getMessage() . "\n";
        }
    }

    echo "\n✅ Database Restore Complete!\n";

}
catch (Exception $e) {
    die("❌ Fatal Error: " . $e->getMessage() . "\n");
}
