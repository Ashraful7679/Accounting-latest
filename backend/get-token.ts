import axios from 'axios';
async function main() {
  try {
    const response = await axios.post('http://localhost:5002/api/auth/login', {
      email: 'admin@accounting.com',
      password: 'admin123'
    });
    console.log('---TOKEN_START---');
    console.log(response.data.data.token);
    console.log('---TOKEN_END---');
  } catch (error: any) {
    console.error('Login failed:', error.response?.data || error.message);
  }
}
main();
