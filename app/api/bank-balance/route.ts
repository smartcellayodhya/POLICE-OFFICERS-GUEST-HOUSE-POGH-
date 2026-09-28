import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getServerSupabaseClient } from '@/lib/supabaseServer';

const SINGLETON_BANK_BALANCE_ID = '00000000-0000-0000-0000-000000000001';
const CONFIG_KEY_RECORD = 'pogh_bank_balance_record';
const CONFIG_KEY_HISTORY = 'pogh_bank_balance_history';

export async function GET(req: NextRequest) {
  try {
    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({
        success: true,
        data: null,
        synced: false,
        reason: 'Supabase server client not configured',
      });
    }

    // 1. Try reading from dedicated pogh_bank_balance table if available
    try {
      const { data: tableData, error: tableError } = await client
        .from('pogh_bank_balance')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tableError && tableData) {
        return NextResponse.json({
          success: true,
          data: tableData,
          synced: true,
          source: 'pogh_bank_balance',
        });
      }
    } catch {
      // Proceed to cloud config table fallback
    }

    // 2. Read from persistent Supabase pogh_auth_config table
    const { data: configData, error: configError } = await client
      .from('pogh_auth_config')
      .select('*')
      .eq('key', CONFIG_KEY_RECORD)
      .maybeSingle();

    if (!configError && configData && configData.value) {
      try {
        const record = JSON.parse(configData.value);

        // Also fetch history if present
        let history: any[] = [];
        try {
          const { data: histData } = await client
            .from('pogh_auth_config')
            .select('value')
            .eq('key', CONFIG_KEY_HISTORY)
            .maybeSingle();
          if (histData && histData.value) {
            history = JSON.parse(histData.value);
          }
        } catch {
          // Ignore history parse error
        }

        return NextResponse.json({
          success: true,
          data: record,
          history,
          synced: true,
          source: 'pogh_auth_config',
        });
      } catch (err: any) {
        console.error('Error parsing bank balance from pogh_auth_config:', err);
      }
    }

    return NextResponse.json({
      success: true,
      data: null,
      synced: false,
      reason: 'No cloud record found yet',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, data: null, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    const body = await req.json();

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, synced: false, error: 'डेटाबेस कनेक्शन उपलब्ध नहीं है' },
        { status: 500 }
      );
    }

    const updater =
      user?.displayName ||
      user?.username ||
      body.updated_by ||
      'SSP Office Administrator';

    const record = {
      id: SINGLETON_BANK_BALANCE_ID,
      account_name:
        body.account_name ||
        'भारतीय स्टेट बैंक (SBI) - पुलिस ऑफिसर्स गेस्ट हाउस संचालन खाता',
      account_number: body.account_number || 'XXXX4589',
      current_balance: Number(body.current_balance) || 0,
      as_of_date: body.as_of_date || new Date().toISOString().slice(0, 10),
      notes: body.notes || 'पासबुक प्रविष्टि के अनुसार',
      updated_by: updater,
      updated_at: new Date().toISOString(),
    };

    let tableSaved = false;

    // 1. Try saving to pogh_bank_balance table if it exists
    try {
      const { data, error } = await client
        .from('pogh_bank_balance')
        .upsert(record, { onConflict: 'id' })
        .select()
        .maybeSingle();
      if (!error && data) {
        tableSaved = true;
      }
    } catch {
      // pogh_bank_balance table might not exist
    }

    // 2. Persist to pogh_auth_config table (guaranteed cloud sync across all devices)
    const { error: configError } = await client.from('pogh_auth_config').upsert({
      key: CONFIG_KEY_RECORD,
      value: JSON.stringify(record),
      updated_at: record.updated_at,
    });

    if (configError && !tableSaved) {
      console.error('Failed to sync bank balance to Supabase cloud:', configError.message);
      return NextResponse.json(
        {
          success: false,
          synced: false,
          error: configError.message,
        },
        { status: 500 }
      );
    }

    // 3. Update audit history list in cloud
    try {
      const { data: histData } = await client
        .from('pogh_auth_config')
        .select('value')
        .eq('key', CONFIG_KEY_HISTORY)
        .maybeSingle();

      let currentHist: any[] = [];
      if (histData && histData.value) {
        try {
          currentHist = JSON.parse(histData.value);
        } catch {}
      }

      const newHistoryItem = {
        id: 'bb_hist_' + Date.now(),
        amount: record.current_balance,
        as_of_date: record.as_of_date,
        notes: record.notes,
        updated_by: record.updated_by,
        timestamp: record.updated_at,
      };

      const updatedHist = [newHistoryItem, ...currentHist.slice(0, 29)]; // Retain latest 30 audit entries

      await client.from('pogh_auth_config').upsert({
        key: CONFIG_KEY_HISTORY,
        value: JSON.stringify(updatedHist),
        updated_at: record.updated_at,
      });
    } catch (histErr) {
      console.warn('Bank balance history save failed (non-critical):', histErr);
    }

    return NextResponse.json({
      success: true,
      synced: true,
      data: record,
    });
  } catch (err: any) {
    console.error('POST /api/bank-balance error:', err);
    return NextResponse.json(
      { success: false, synced: false, error: err.message },
      { status: 500 }
    );
  }
}
