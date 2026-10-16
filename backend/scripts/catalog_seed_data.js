// Fictional MidHealth profiles; never reuse real marketplace identities or photos.
export const specialties = [
  { slug: 'noi-tong-quat', name: 'Nội tổng quát', image: 'Noitongquat.webp' },
  { slug: 'nhi-khoa', name: 'Nhi khoa', image: 'Nhikhoa.webp' },
  { slug: 'san-phu-khoa', name: 'Sản phụ khoa', image: 'sanphukhoa.webp' },
  { slug: 'da-lieu', name: 'Da liễu', image: 'Dalieu.webp' },
  { slug: 'tai-mui-hong', name: 'Tai - Mũi - Họng', image: 'taimuihong.webp' },
  { slug: 'dinh-duong', name: 'Dinh dưỡng', image: 'Dinhduong.webp' },
];
export const doctors = [
  { slug: 'midhealth-demo-minh-an', name: 'BS. Nguyễn Minh An', initials: 'MA', specialty: 'Nội tổng quát', image: '/image_doctor/e51eb8bfbe903fce6681.jpg' },
  { slug: 'midhealth-demo-thao-linh', name: 'BS. Trần Thảo Linh', initials: 'TL', specialty: 'Nhi khoa', image: '/image_doctor/f7698cf68ad90b8752c8.jpg' },
  { slug: 'midhealth-demo-ngoc-ha', name: 'BS. Lê Ngọc Hà', initials: 'NH', specialty: 'Sản phụ khoa', image: '/image_doctor/f7698cf68ad90b8752c8.jpg' },
  { slug: 'midhealth-demo-quang-huy', name: 'BS. Phạm Quang Huy', initials: 'QH', specialty: 'Da liễu', image: '/image_doctor/e51eb8bfbe903fce6681.jpg' },
  { slug: 'midhealth-demo-bao-chau', name: 'BS. Võ Bảo Châu', initials: 'BC', specialty: 'Tai - Mũi - Họng', image: '/image_doctor/f7698cf68ad90b8752c8.jpg' },
  { slug: 'midhealth-demo-hoai-nam', name: 'BS. Đặng Hoài Nam', initials: 'HN', specialty: 'Dinh dưỡng', image: '/image_doctor/e51eb8bfbe903fce6681.jpg' },
].map(doctor => ({ ...doctor, workplace: 'MidHealth', isDemo: true,
  intro: 'Hồ sơ mô phỏng phục vụ trải nghiệm đặt lịch tại MidHealth, không đại diện cho bác sĩ hành nghề thực tế.' }));
