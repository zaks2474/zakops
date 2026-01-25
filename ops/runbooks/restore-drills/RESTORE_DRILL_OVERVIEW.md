# Restore Drill Overview

Regular restore drills validate that our backup and recovery procedures work correctly.

## Purpose

1. **Verify backups** - Confirm backups are complete and restorable
2. **Test procedures** - Validate runbooks are accurate
3. **Measure RTO** - Track recovery time objective
4. **Train team** - Practice recovery procedures

## Schedule

- **Monthly**: Automated restore drill in isolated environment
- **Quarterly**: Full manual drill with team participation
- **After changes**: Whenever backup procedures are modified

## Components

### Backup Script (`tools/ops/backup_restore/backup.sh`)
- Creates PostgreSQL dump
- Generates checksums
- Creates manifest with table counts
- Compresses backup

### Restore Script (`tools/ops/backup_restore/restore.sh`)
- Verifies backup integrity
- Restores to target database
- Supports isolated restore environment

### Verification Script (`tools/ops/backup_restore/verify.sh`)
- Checks required tables exist
- Validates data integrity
- Verifies foreign key relationships
- Confirms indexes present

### Drill Runner (`tools/ops/backup_restore/restore_drill_runner.py`)
- Automates full drill cycle
- Generates JSON artifacts
- Reports pass/fail status

## Running a Drill

### Automated Drill
```bash
# Run via Make
make restore-drill

# Or directly
python3 tools/ops/backup_restore/restore_drill_runner.py
```

### Manual Drill (Step by Step)

1. **Create backup**:
   ```bash
   ./tools/ops/backup_restore/backup.sh --output /tmp/drill_backup
   ```

2. **Start isolated restore environment**:
   ```bash
   docker-compose -f deployments/docker/compose.restore.yml up -d
   ```

3. **Restore to isolated environment**:
   ```bash
   DB_HOST=localhost DB_PORT=15432 DB_NAME=zakops_restore \
     ./tools/ops/backup_restore/restore.sh --input /tmp/drill_backup/*
   ```

4. **Verify restoration**:
   ```bash
   DB_HOST=localhost DB_PORT=15432 DB_NAME=zakops_restore \
     ./tools/ops/backup_restore/verify.sh
   ```

5. **Cleanup**:
   ```bash
   docker-compose -f deployments/docker/compose.restore.yml down -v
   ```

## Artifacts

Drills produce artifacts in `artifacts/restore/`:
- `restore_drill_<timestamp>.json` - Full drill report
- `verify_<timestamp>.json` - Verification results

## Success Criteria

A restore drill passes when:
1. Backup completes without errors
2. Checksums verify correctly
3. Restore completes successfully
4. All required tables exist
5. Data integrity checks pass
6. Foreign key relationships are valid

## RTO/RPO Targets

- **RPO (Recovery Point Objective)**: Last backup (max 24h with daily backups)
- **RTO (Recovery Time Objective)**: < 30 minutes for full restore

## Escalation

If a drill fails:
1. Document the failure in artifacts
2. Create incident ticket
3. Do not modify production until resolved
4. Schedule follow-up drill after fix
