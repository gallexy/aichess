import { OpeningStats } from '../types';

export const getOpeningStats = async (fen: string): Promise<OpeningStats | null> => {
  try {
    // Using Lichess public API (Player database for larger sample size, matching the screenshot's '700k+ games')
    // We include speeds blitz, rapid, classical to get a good mix of serious games
    const response = await fetch(`https://explorer.lichess.ovh/lichess?variant=standard&fen=${encodeURIComponent(fen)}&speeds=blitz,rapid,classical&ratings=1600,1800,2000,2200,2500`);
    
    if (!response.ok) {
      console.warn(`Opening API Error: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch opening stats", error);
    return null;
  }
};