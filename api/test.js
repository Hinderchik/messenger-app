export default function handler(req, res) {
  res.status(200).json({ 
    message: 'API is working',
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL
    }
  });
}
