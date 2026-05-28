import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // ป้องกันการใช้ Proxy เพื่อดึงข้อมูลปลายทางที่ไม่เหมาะสม
  if (!targetUrl.startsWith('https://maps.googleapis.com/maps/api/staticmap')) {
    return new NextResponse('Invalid target URL', { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      next: { revalidate: 3600 }, // แคชภาพไว้ 1 ชั่วโมงเพื่อประสิทธิภาพ
    });

    if (!res.ok) {
      return new NextResponse('Failed to fetch static map', { status: res.status });
    }

    const blob = await res.blob();
    const headers = new Headers();
    
    // ตั้งค่าประเภทเนื้อหาให้ตรงกับรูปภาพจริง และส่ง CORS Header กลับไปให้เบราว์เซอร์แบบเปิดเผย
    headers.set('Content-Type', blob.type || 'image/png');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=86400'); // แคชที่เบราว์เซอร์ 24 ชั่วโมงเพื่อความไว

    return new NextResponse(blob, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Map proxy route error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
