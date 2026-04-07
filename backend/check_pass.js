const bcrypt = require('bcryptjs');

async function check() {
  const hash = '$2a$10$iwsoX6o/Mpx/GK2Fdmbpd1N0bBwcIiJxw2AtMb84QKfdJg/m';
  const passwords = ['admin123', 'alinairin7679', 'alinairin#7679', 'password', '123456'];
  
  for (const pw of passwords) {
    const isValid = await bcrypt.compare(pw, hash);
    console.log(`Is '${pw}' valid?`, isValid);
    if (isValid) break;
  }
}

check();
