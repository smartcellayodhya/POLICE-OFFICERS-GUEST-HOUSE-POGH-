import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getServerSupabaseClient } from '@/lib/supabaseServer';

const SINGLETON_BANK_BALANCE_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
  try {
    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: true, data: null, synced: false, reason: 'Supabase server client not configured' });
    }

    const { data, error } = await client
      .from('pogh_bank_balance')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ 
        success: true, 
        data: null, 
        synced: false, 
        tableMissing: error.code === 'PGRST205' || error.message.includes('pogh_bank_balance'),
        error: error.message 
      });
    }

    return NextResponse.json({ success: true, data: data || null, synced: !!data });
  } catch (err: any) {
    return NextResponse.json({ success: false, data: null, error: err.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'सत्र समाप्त या अनधिकृत (Login required to update balance)' }, { status: 401 });
    }

    const body = await req.json();
    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ success: false, synced: false, error: 'डेटाबेस कनेक्शन उपलब्ध नहीं है' }, { status: 500 });
    }

    const record = {
      id: SINGLETON_BANK_BALANCE_ID,
      account_name: body.account_name || 'भारतीय स्टेट बैंक (SBI) - पुलिस ऑफिसर्स गेस्ट हाउस संचालन खाता',
      account_number: body.account_number || 'XXXX4589',
      current_balance: Number(body.current_balance) || 0,
      as_of_date: body.as_of_date || new Date().toISOString().slice(0, 10),
      notes: body.notes || 'पासबुक प्रविष्टि के अनुसार',
      updated_by: user.displayName || user.username || 'SSP Office Administrator',
      updated_at: new Date().toISOString(),
    };

    // Upsert singleton row in database
    const { data, error } = await client
      .from('pogh_bank_balance')
      .upsert(record, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Supabase bank balance table save failed:', error.message);
      return NextResponse.json({
        success: false,
        synced: false,
        tableMissing: error.code === 'PGRST205' || error.message.includes('pogh_bank_balance'),
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, synced: true, data: data || record });
  } catch (err: any) {
    return NextResponse.json({ success: false, synced: false, error: err.message }, { status: 500 });
  }
}

