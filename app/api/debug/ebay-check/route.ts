import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

export async function GET() {
  try {
    const db = await getDb()
    const coll = db.collection('fibu_ebay_transactions')
    
    const total = await coll.countDocuments()
    
    const byMonth = await coll.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$datumDate" }},
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 }}
    ]).toArray()
    
    const sample = await coll.findOne({}, { sort: { datumDate: -1 }})
    
    return NextResponse.json({
      ok: true,
      total,
      byMonth,
      sample: sample ? {
        transactionId: sample.transactionId,
        datum: sample.datum,
        betrag: sample.betrag,
        orderId: sample.orderId
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
