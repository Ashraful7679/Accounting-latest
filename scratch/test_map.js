
const obj = { a: 1 };
try {
  console.log("Testing obj?.map:");
  obj?.map(x => x);
} catch (e) {
  console.log("Caught expected error:", e.message);
}

const arr = [1, 2];
console.log("Testing arr?.map:");
arr?.map(x => console.log(x));
