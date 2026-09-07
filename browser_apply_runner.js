/* Generic browser apply runner.
 * Paste generated output/browser_runner_with_plan.js into DevTools Console on your target web app page.
 * Adapt loadEmployeeRecords() and updateEmployeeRecord() for your own frontend app.
 */
(() => {
  const PLAN = window.__APPROVAL_SYNC_PLAN__ || [];

  const normalise = value => value == null || String(value).trim() === '' ? null : String(value).trim();
  const key = value => normalise(value)?.replace(/\s+/g, ' ').toLowerCase() ?? null;
  const compactKey = value => key(value)?.replace(/[^\p{L}\p{N}]+/gu, '') ?? null;
  const stripTitles = value => key(value)
    ?.replace(/^(dr|prof|professor|associate professor|associate prof|mr|mrs|ms|miss)\.?\s+/i, '')
    .replace(/,?\s*(phd|ph\.d\.|mba|ma|msc|m\.sc\.|bsc|b\.sc\.)$/i, '')
    .trim() ?? null;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function loadEmployeeRecords() {
    // TODO: Adapt this to your web app.
    // It should return an array of employees with at least:
    // id, fullName, status, isVisible, plus target approval fields.
    throw new Error('Please implement loadEmployeeRecords() for your web app.');
  }

  async function updateEmployeeRecord(payload) {
    // TODO: Adapt this to your web app.
    // Example payload: { id: employeeId, level4Approvers: approverId }
    throw new Error('Please implement updateEmployeeRecord(payload) for your web app.');
  }

  const buildNameIndexes = employees => {
    const exact = new Map();
    const compact = new Map();
    const stripped = new Map();
    const add = (map, mapKey, employee) => {
      if (!mapKey) return;
      const rows = map.get(mapKey) ?? [];
      rows.push(employee);
      map.set(mapKey, rows);
    };

    for (const employee of employees) {
      for (const name of [employee.fullName, employee.name, employee.englishName, employee.preferredName, employee.displayName]) {
        add(exact, key(name), employee);
        add(compact, compactKey(name), employee);
        add(stripped, stripTitles(name), employee);
      }
    }

    return { exact, compact, stripped };
  };

  const activeVisibleUnique = employees => {
    const filtered = employees.filter(employee => {
      const active = employee.status == null || employee.status === 'active';
      const visible = employee.isVisible == null || employee.isVisible === true || employee.isHrVisible === true;
      return active && visible;
    });
    return [...new Map(filtered.map(employee => [employee.id, employee])).values()];
  };

  const resolveApprover = (item, indexes) => {
    const attempts = [...new Set((item.aliases || [item.sourceApprover]).flatMap(alias => [alias, stripTitles(alias)]).filter(Boolean))];
    for (const alias of attempts) {
      const matches = [
        ...(indexes.exact.get(key(alias)) ?? []),
        ...(indexes.stripped.get(stripTitles(alias)) ?? []),
        ...(indexes.compact.get(compactKey(alias)) ?? []),
      ];
      const unique = activeVisibleUnique(matches);
      if (unique.length === 1) return { approver: unique[0], matchedAlias: alias };
      if (unique.length > 1) {
        return {
          error: 'Approver alias matched multiple active/visible employees',
          matchedAlias: alias,
          candidates: unique.map(employee => ({ id: employee.id, fullName: employee.fullName })),
        };
      }
    }
    return { error: 'Approver alias did not match any active/visible employee', matchedAlias: attempts.join(' | ') };
  };

  window.runApprovalSync = async ({ apply = false } = {}) => {
    const records = await loadEmployeeRecords();
    const employees = new Map(records.map(employee => [employee.id, employee]));
    const indexes = buildNameIndexes(records);
    const ready = [];
    const alreadyCorrect = [];
    const skipped = [];

    for (const item of PLAN) {
      const employee = employees.get(item.employeeId);
      if (!employee) {
        skipped.push({ ...item, reason: 'Employee record is missing' });
        continue;
      }

      const resolved = resolveApprover(item, indexes);
      if (!resolved.approver) {
        skipped.push({ ...item, reason: resolved.error, matchedAlias: resolved.matchedAlias, candidates: resolved.candidates });
        continue;
      }

      if (normalise(employee[item.field]) === resolved.approver.id) {
        alreadyCorrect.push({ ...item, approverId: resolved.approver.id, approverName: resolved.approver.fullName, matchedAlias: resolved.matchedAlias });
        continue;
      }

      if (normalise(employee[item.field]) !== null) {
        skipped.push({ ...item, reason: 'Target field is not blank; skipped to avoid overwriting existing value', currentValue: employee[item.field], approverId: resolved.approver.id, approverName: resolved.approver.fullName, matchedAlias: resolved.matchedAlias });
        continue;
      }

      ready.push({ ...item, approverId: resolved.approver.id, approverName: resolved.approver.fullName, matchedAlias: resolved.matchedAlias });
    }

    const result = { mode: apply ? 'apply' : 'dry-run', planned: PLAN.length, ready, alreadyCorrect, skipped, succeeded: [], failed: [] };
    if (!apply) {
      console.table(skipped);
      console.info('[Approval sync] Dry run complete.', { planned: PLAN.length, ready: ready.length, alreadyCorrect: alreadyCorrect.length, skipped: skipped.length });
      window.__approvalSyncResult = result;
      return result;
    }

    for (const [index, item] of ready.entries()) {
      try {
        await updateEmployeeRecord({ id: item.employeeId, [item.field]: item.approverId });
        result.succeeded.push(item);
      } catch (error) {
        result.failed.push({ ...item, reason: error instanceof Error ? error.message : String(error) });
      }
      if ((index + 1) % 10 === 0 || index + 1 === ready.length) {
        console.info('[Approval sync] Progress ' + (index + 1) + '/' + ready.length, { succeeded: result.succeeded.length, failed: result.failed.length });
      }
      await wait(120);
    }

    console.table(result.failed);
    console.info('[Approval sync] Apply complete.', { planned: PLAN.length, ready: ready.length, alreadyCorrect: alreadyCorrect.length, skipped: skipped.length, succeeded: result.succeeded.length, failed: result.failed.length });
    window.__approvalSyncResult = result;
    return result;
  };

  console.info('[Approval sync] Runner loaded. First run: await window.runApprovalSync({ apply: false })');
})();
