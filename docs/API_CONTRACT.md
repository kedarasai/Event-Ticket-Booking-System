Base path /api/v1. Success: {success:true,message,data}. Error: {success:false,message}. Status codes: 200,201,400,401,403,404,409,500.
- POST /auth/register {name,email,password}; POST /auth/login {email,password} -> data:{token,user:{userId,name,email,role}}
- GET /auth/me (auth) -> data:{user:{userId,name,email,role}}
- GET /events?search&page&limit -> data:{events:[{eventId,title,description,venue,eventDate,price,category,imageUrl,availableSeats,totalSeats}],pagination:{page,limit,total}}
- GET /events/:eventId -> data:{event:{same fields}}
- GET /events/:eventId/seats -> data:{eventId,price,seats:[{seatId,seatNumber,row,number,status}]} status: AVAILABLE|BOOKED
- POST /bookings (auth) {eventId,seatIds[]} + optional header Idempotency-Key -> 201 data:{bookingId,bookingReference,status,eventId,seatIds,seatNumbers,totalAmount}. Replay of the same key -> 200 with the same data. Taken seat -> 409 "One or more selected seats are no longer available."
- GET /bookings/my (auth) -> data:{bookings:[{bookingId,bookingReference,status,totalAmount,createdAt,event:{eventId,title,venue,eventDate},seatNumbers}]}
- GET /bookings/:bookingId (auth, owner or ADMIN, else 403) -> data:{booking:{same shape as one item above, plus eventId and seatIds}}
- POST /bookings/:bookingId/cancel (auth, owner or ADMIN) -> data:{bookingId,status:"CANCELLED"}; already cancelled -> 409
