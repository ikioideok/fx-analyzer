import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ClosedTrade } from '@/app/types';

// The path to our pseudo-database file
const dataFilePath = path.join(process.cwd(), 'data', 'trades.json');

// Helper function to ensure the data directory exists before we try to read/write.
async function ensureDataDirectoryExists() {
  try {
    await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
  } catch (error) {
    // This might fail if the directory already exists, which is fine.
    // More serious errors will be caught by the read/write operations.
    console.error("Could not create data directory (this might be okay):", error);
  }
}

/**
 * Handles GET requests to /api/trades.
 * Reads the trades data from the JSON file and returns it.
 */
export async function GET() {
  await ensureDataDirectoryExists();
  try {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const trades = JSON.parse(fileContent);
    return NextResponse.json(trades);
  } catch (error: any) {
    // If the file doesn't exist (e.g., on first run), return an empty array.
    // This is the expected state before any trades are saved.
    if (error.code === 'ENOENT') {
      return NextResponse.json([]);
    }
    console.error('Failed to read trades data:', error);
    return NextResponse.json({ message: 'Error reading trades data.' }, { status: 500 });
  }
}

/**
 * Handles POST requests to /api/trades.
 * Receives trade data in the request body and writes it to the JSON file.
 */
export async function POST(request: Request) {
  await ensureDataDirectoryExists();
  try {
    const trades: ClosedTrade[] = await request.json();
    await fs.writeFile(dataFilePath, JSON.stringify(trades, null, 2), 'utf-8');
    return NextResponse.json({ message: 'Trades saved successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Failed to save trades data:', error);
    return NextResponse.json({ message: 'Error saving trades data.' }, { status: 500 });
  }
}
