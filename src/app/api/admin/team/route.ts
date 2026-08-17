import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/admin/team
 * Creates a new team in a league.
 *
 * Body:
 *   {
 *     leagueId: string,
 *     shortCode: string,       // e.g. "DHK" — used as team ID prefix
 *     fullName?: string,       // e.g. "Dhaka Dynamites" (defaults to shortCode)
 *     color?: string,          // hex color, e.g. "#d32f2f" (defaults to slate gray)
 *     city?: string,           // e.g. "Dhaka" (optional)
 *   }
 *
 * Team ID is constructed as `${leagueId}_${shortCode}`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leagueId, shortCode, fullName, color, city } = body;

    if (!leagueId || !shortCode) {
      return NextResponse.json(
        { error: 'leagueId and shortCode are required' },
        { status: 400 }
      );
    }

    // Validate shortCode (no spaces, underscores, or special chars)
    const cleanCode = String(shortCode).trim().toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(cleanCode)) {
      return NextResponse.json(
        { error: 'Short code must be 1-8 letters/numbers, no spaces or special chars' },
        { status: 400 }
      );
    }

    // Verify league exists
    const league = await db.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      return NextResponse.json({ error: `League ${leagueId} not found` }, { status: 404 });
    }

    const teamId = `${leagueId}_${cleanCode}`;

    // Check for duplicate
    const existing = await db.team.findUnique({ where: { id: teamId } });
    if (existing) {
      return NextResponse.json(
        { error: `Team ${cleanCode} already exists in league ${leagueId}` },
        { status: 409 }
      );
    }

    // Validate color if provided
    let teamColor = '#64748b'; // default slate gray
    if (color) {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return NextResponse.json(
          { error: 'Color must be a hex code like #d32f2f' },
          { status: 400 }
        );
      }
      teamColor = color;
    }

    const team = await db.team.create({
      data: {
        id: teamId,
        name: cleanCode,
        fullName: fullName?.trim() || cleanCode,
        color: teamColor,
        city: city?.trim() || null,
        leagueId,
        // All other fields default per schema (elo=1500, matches=0, etc.)
      },
    });

    return NextResponse.json({
      ok: true,
      team: {
        id: team.id,
        name: team.name,
        fullName: team.fullName,
        color: team.color,
        city: team.city,
        leagueId: team.leagueId,
        elo: team.elo,
      },
    });
  } catch (e: any) {
    console.error('Create team error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
