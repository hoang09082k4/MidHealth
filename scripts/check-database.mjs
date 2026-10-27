import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = name => fs.readFile(new URL(name, root), 'utf8');
const db = new PGlite();
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); console.log(`OK ${name}`); };
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
try {
  // Minimal Supabase platform objects. Storage API and PostgREST are not simulated.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
  await check('fresh schema executes on PostgreSQL', async () => {
    const schema = (await read('supabase/schema.sql')).replace(/create extension if not exists pgcrypto;/g, '');
    // gen_random_uuid is built into PostgreSQL; the pgcrypto extension is not bundled with WASM.
    await db.exec(schema);
  });
  await check('fresh schema includes clinic booking RPCs', async () => {
    assert.equal(await scalar("select to_regprocedure('public.create_clinic_booking(jsonb)') is not null"), true);
    assert.equal(await scalar("select to_regprocedure('public.create_clinic_walkin_booking(uuid,uuid,uuid,boolean,text)') is not null"), true);
  });
  await check('fresh schema has five clinic roles without marketplace tables', async () => {
    assert.equal(await scalar("select to_regclass('public.medical_facilities')"), null);
    assert.equal(await scalar("select to_regclass('public.provider_workspaces')"), null);
    assert.equal(await scalar("select to_regclass('public.health_experts')"), null);
    const roles = (await db.query("select unnest(enum_range(null::public.app_user_role))::text as role")).rows.map(row => row.role);
    assert.deepEqual(roles, ['patient', 'staff', 'doctor', 'head', 'admin']);
  });
  await check('browser roles cannot read private data or execute privileged RPCs', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['app_users', 'patient_profiles', 'appointments', 'payments', 'email_otp_challenges']) {
        assert.equal(await scalar('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, 'SELECT']), false);
      }
      assert.equal(await scalar("select has_function_privilege($1, 'public.consume_email_otp(text,uuid)', 'EXECUTE')", [role]), false);
      for (const fn of ['public.claim_appointment_emails(integer)', 'public.check_in_clinic_appointment(uuid,text,date,uuid)',
        'public.complete_clinic_visit(uuid,text,text,text,text,text,uuid)', 'public.set_clinic_doctor_absence(uuid,boolean,date,date,text)',
        'public.reschedule_clinic_appointment(uuid,uuid)', 'public.confirm_clinic_deposit(uuid)',
        'public.create_clinic_walkin_booking(uuid,uuid,uuid,boolean,text)',
        'public.create_counter_patient(uuid,text,text,text,text,date,text,text,text,text)',
        'public.record_specialty_exam(uuid,uuid,text,text,uuid,uuid,jsonb)',
        'public.finalize_clinic_visit(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb)',
        'public.append_clinical_note_addendum(uuid,uuid,text)',
        'public.clinic_activity_report(date,date,uuid,uuid)']) {
        assert.equal(await scalar('select has_function_privilege($1,$2,$3)', [role, fn, 'EXECUTE']), false);
      }
    }
  });
  await check('OTP cooldown, attempt lock, verification and consumption are persisted', async () => {
    const email = 'test@example.com';
    const request = () => scalar("select public.request_email_otp($1,'hash',now()+interval '5 minutes')", [email]);
    assert.equal(await request(), 'created');
    assert.equal(await request(), 'cooldown');
    const id = '11111111-1111-4111-8111-111111111111';
    for (let attempt = 1; attempt <= 5; attempt++) {
      assert.equal(await scalar('select public.verify_email_otp($1,$2,$3)', [email, 'wrong', id]), attempt === 5 ? 'locked' : 'invalid');
    }
    assert.equal(await scalar('select public.verify_email_otp($1,$2,$3)', [email, 'hash', id]), 'locked');
    await db.exec("update public.email_otp_challenges set last_sent_at=now()-interval '2 minutes'");
    assert.equal(await request(), 'created');
    assert.equal(await scalar('select public.verify_email_otp($1,$2,$3)', [email, 'hash', id]), 'verified');
    assert.equal(await scalar('select public.verify_email_otp($1,$2,$3)', [email, 'hash', id]), 'expired');
    assert.equal(await scalar('select public.consume_email_otp($1,$2)', [email, id]), true);
    assert.equal(await scalar('select public.consume_email_otp($1,$2)', [email, id]), false);
  });
  await check('slot capacity and cancellation are enforced by PostgreSQL', async () => {
    await db.exec(`insert into public.app_users(firebase_uid,email) values ('test','test@example.com');
      insert into public.patient_profiles(firebase_uid,app_user_id,email,full_name,phone,date_of_birth,gender)
        select 'test',id,'test@example.com','Test patient','0900000000','2000-01-01','other' from public.app_users;
      insert into public.patient_medical_profiles(owner_profile_id,full_name,phone,date_of_birth,gender)
        select id,'Test patient','0900000000','2000-01-01','other' from public.patient_profiles;
      insert into public.clinic_specialties(name,slug) values ('Test specialty','test-specialty');
      insert into public.doctors(full_name,specialty_id) select 'Test doctor',id from public.clinic_specialties;
      insert into public.appointment_slots(doctor_id,specialty_id,slot_date,start_time,end_time)
        select id,specialty_id,current_date+2,'09:00','09:30' from public.doctors;`);
    const slot = await scalar('select id from public.appointment_slots limit 1');
    assert.equal((await db.query('select * from public.claim_appointment_slot($1)', [slot])).rows.length, 1);
    assert.equal((await db.query('select * from public.claim_appointment_slot($1)', [slot])).rows.length, 0);
    await db.exec(`insert into public.appointments(owner_profile_id,patient_medical_profile_id,appointment_slot_id,doctor_id,specialty_id,appointment_date,appointment_time,patient_name)
      select p.owner_profile_id,p.id,s.id,s.doctor_id,s.specialty_id,s.slot_date,s.start_time,p.full_name from public.patient_medical_profiles p cross join public.appointment_slots s;`);
    const appointment = await scalar('select id from public.appointments limit 1');
    await assert.rejects(db.exec('delete from public.patient_profiles'), /foreign key constraint/);
    await assert.rejects(db.exec("update public.appointment_slots set start_time='10:00',end_time='10:30'"), /Cannot move/);
    await assert.rejects(db.query("select * from public.transition_clinic_appointment($1,null,null,'completed')", [appointment]), /check in first/);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [appointment]);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [appointment]);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 0);
    await assert.rejects(db.exec('delete from public.appointment_slots'), /Cannot delete/);
  });
  await check('booking RPC commits ticket and capacity together and rolls back failures', async () => {
    await db.exec('update public.doctors set consultation_fee=250000 where id=(select doctor_id from public.appointment_slots limit 1)');
    const booking = (await db.query(`select jsonb_build_object(
      'owner_profile_id',p.owner_profile_id,'patient_medical_profile_id',p.id,
      'appointment_slot_id',s.id,'doctor_id',s.doctor_id,'specialty_id',s.specialty_id,
      'final_amount',250000,'reason','Test booking') as booking
      from public.patient_medical_profiles p cross join public.appointment_slots s limit 1`)).rows[0].booking;
    await assert.rejects(db.query('select public.create_clinic_booking($1)', [{ ...booking, final_amount: 1 }]), /fee changed/);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 0);
    const created = await scalar('select public.create_clinic_booking($1)', [booking]);
    assert.ok(created.appointment.id && created.ticket.id);
    assert.equal(created.appointment.status, 'pending');
    assert.equal(Number(created.appointment.final_amount), 250000);
    assert.equal(Number(created.appointment.deposit_amount), 75000);
    await assert.rejects(db.query("select * from public.transition_clinic_appointment($1,null,null,'confirmed')", [created.appointment.id]), /Deposit must be paid/);
    await assert.rejects(db.query("update public.appointments set status='no_show' where id=$1", [created.appointment.id]), /Only confirmed appointments/);
    assert.equal(created.appointment.id, created.ticket.appointment_id);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 1);
    await db.exec('update public.appointment_slots set capacity=2');
    await assert.rejects(db.query('select public.create_clinic_booking($1)', [booking]), /already booked/);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 1);
    const otherPatient = await scalar(`insert into public.patient_medical_profiles(owner_profile_id,full_name,phone,date_of_birth,gender)
      select owner_profile_id,'Second patient','0900000001','2001-01-01','other'
      from public.patient_medical_profiles where id=$1 returning id`, [booking.patient_medical_profile_id]);
    const secondBooking = { ...booking, patient_medical_profile_id: otherPatient };
    const second = await scalar('select public.create_clinic_booking($1)', [secondBooking]);
    assert.ok(second.appointment.id && second.ticket.id);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 2);
    await assert.rejects(db.query('select public.create_clinic_booking($1)', [booking]), /Slot is unavailable/);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 2);
    const pendingPayment = await scalar(`insert into public.payments(appointment_id,amount,provider,status,paypal_order_id)
      values($1,75000,'paypal','pending','TEST-PENDING-ORDER') returning id`, [created.appointment.id]);
    await assert.rejects(db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [created.appointment.id]), /pending reconciliation/);
    await db.query("update public.payments set status='failed' where id=$1", [pendingPayment]);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [created.appointment.id]);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [second.appointment.id]);
    const staffActor = await scalar("insert into public.app_users(firebase_uid,email,role) values ('staff-test','staff-test@example.com','staff') returning id");
    await db.exec(`insert into public.clinic_profile(id,profile) values (true,'{"depositPercent":40}'::jsonb)
      on conflict (id) do update set profile=excluded.profile`);
    const patientActor = await scalar("select id from public.app_users where role='patient' limit 1");
    await assert.rejects(db.query('select public.create_clinic_walkin_booking($1,$2,$3,true,$4)',
      [otherPatient, booking.appointment_slot_id, patientActor, 'Counter visit']), /Only reception staff/);
    await assert.rejects(db.query('select public.create_clinic_walkin_booking($1,$2,$3,false,$4)',
      [otherPatient, booking.appointment_slot_id, staffActor, 'Counter visit']), /deposit must be received/);
    const counter = await scalar('select public.create_clinic_walkin_booking($1,$2,$3,true,$4)',
      [otherPatient, booking.appointment_slot_id, staffActor, 'Counter visit']);
    assert.ok(counter.appointment_code);
    assert.equal(await scalar('select status from public.appointments where id=$1', [counter.appointment_id]), 'confirmed');
    assert.equal(Number(await scalar('select amount from public.payments where appointment_id=$1', [counter.appointment_id])), 100000);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [counter.appointment_id]);
    await db.exec('update public.doctors set consultation_fee=null where id=(select doctor_id from public.appointment_slots limit 1)');
    await db.query('update public.clinic_specialties set consultation_fee=0 where id=$1', [booking.specialty_id]);
    const freeCounter = await scalar('select public.create_clinic_walkin_booking($1,$2,$3,false,$4)',
      [otherPatient, booking.appointment_slot_id, staffActor, 'Free visit']);
    assert.equal(await scalar('select status from public.appointments where id=$1', [freeCounter.appointment_id]), 'confirmed');
    assert.equal(await scalar('select count(*)::int from public.payments where appointment_id=$1', [freeCounter.appointment_id]), 0);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'cancelled')", [freeCounter.appointment_id]);
    await db.query('update public.clinic_specialties set consultation_fee=180000 where id=$1', [booking.specialty_id]);
    await db.exec(`update public.clinic_profile set profile='{"depositPercent":30}'::jsonb where id=true`);
    const before = await scalar('select count(*)::int from public.appointments');
    const beforeTickets = await scalar('select count(*)::int from public.queue_tickets');
    await db.exec('delete from public.queue_number_counter');
    await assert.rejects(db.query('select public.create_clinic_booking($1)', [{ ...booking, final_amount: 180000 }]), /not initialized/);
    assert.equal(await scalar('select count(*)::int from public.appointments'), before);
    assert.equal(await scalar('select booked_count from public.appointment_slots'), 0);
    assert.equal(await scalar('select count(*)::int from public.queue_tickets'), beforeTickets);
  });
  await check('reception creates complete patient records with role enforcement', async () => {
    const staff = await scalar("select id from public.app_users where role='staff' limit 1");
    const patient = await scalar("select id from public.app_users where role='patient' limit 1");
    const args = ['counter-patient-uid', 'counter-patient@example.com', 'Counter patient', '0900000002', '2002-01-01', 'female', 'Asthma', 'O+', 'Penicillin'];
    await assert.rejects(db.query('select public.create_counter_patient($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [patient, ...args]), /Only reception staff/);
    const created = await scalar('select public.create_counter_patient($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [staff, ...args]);
    assert.ok(created.patientId && created.accountId);
    assert.equal(await scalar('select role from public.app_users where id=$1', [created.accountId]), 'patient');
    assert.equal(await scalar('select medical_history from public.patient_medical_profiles where id=$1', [created.patientId]), 'Asthma');
    assert.equal(await scalar('select count(*)::int from public.patient_profiles where app_user_id=$1', [created.accountId]), 1);
  });
  await check('identity check-in, clinical result and no-show grace are enforced by PostgreSQL', async () => {
    await db.exec('insert into public.queue_number_counter(id,last_number) select true,coalesce(max(queue_number),0) from public.queue_tickets');
    const source = (await db.query(`select jsonb_build_object('owner_profile_id',p.owner_profile_id,
      'patient_medical_profile_id',p.id,'appointment_slot_id',s.id,'doctor_id',s.doctor_id,
      'specialty_id',s.specialty_id,'final_amount',180000,'reason','Workflow check') as booking
      from public.patient_medical_profiles p cross join public.appointment_slots s where p.full_name='Test patient' limit 1`)).rows[0].booking;
    const first = await scalar('select public.create_clinic_booking($1)', [source]);
    assert.equal(await scalar("select count(*)::int from public.appointment_email_outbox where appointment_id=$1", [first.appointment.id]), 0);
    await assert.rejects(db.query('select * from public.check_in_clinic_appointment($1,$2,$3,$4)',
      [first.appointment.id, 'Wrong patient', '2000-01-01', await scalar('select id from public.app_users limit 1')]), /not open for check-in/);
    await db.query("update public.appointments set appointment_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date, appointment_time='00:00' where id=$1", [first.appointment.id]);
    const actor = await scalar('select id from public.app_users limit 1');
    await assert.rejects(db.query('select * from public.check_in_clinic_appointment($1,$2,$3,$4)',
      [first.appointment.id, 'Wrong patient', '2000-01-01', actor]), /not open for check-in/);
    const payment = await scalar(`insert into public.payments(appointment_id,owner_profile_id,amount,status)
      select id,owner_profile_id,deposit_amount,'paid' from public.appointments where id=$1 returning id`, [first.appointment.id]);
    await db.query('select * from public.confirm_clinic_deposit($1)', [payment]);
    await db.query('select * from public.confirm_clinic_deposit($1)', [payment]);
    assert.equal(await scalar('select status from public.appointments where id=$1', [first.appointment.id]), 'confirmed');
    assert.equal(await scalar("select count(*)::int from public.appointment_email_outbox where appointment_id=$1", [first.appointment.id]), 2);
    await assert.rejects(db.query('select * from public.check_in_clinic_appointment($1,$2,$3,$4)',
      [first.appointment.id, 'Wrong patient', '2000-01-01', actor]), /Patient identity does not match/);
    const patient = (await db.query('select full_name,date_of_birth from public.patient_medical_profiles where id=$1', [source.patient_medical_profile_id])).rows[0];
    await db.query('select * from public.check_in_clinic_appointment($1,$2,$3,$4)', [first.appointment.id, patient.full_name, patient.date_of_birth, actor]);
    assert.ok(await scalar('select checked_in_at from public.appointments where id=$1', [first.appointment.id]));
    await assert.rejects(db.query("select * from public.transition_clinic_appointment($1,null,null,'no_show')", [first.appointment.id]), /Checked-in patient/);
    const doctorActor = await scalar("insert into public.app_users(firebase_uid,email,role,doctor_id) values ('doctor-test','doctor-test@example.com','doctor',$1) returning id", [source.doctor_id]);
    const otherDoctor = await scalar("insert into public.doctors(full_name,specialty_id) values ('Other doctor',$1) returning id", [source.specialty_id]);
    const otherDoctorActor = await scalar("insert into public.app_users(firebase_uid,email,role,doctor_id) values ('doctor-other','doctor-other@example.com','doctor',$1) returning id", [otherDoctor]);
    const encounter = await scalar('select id from public.clinical_encounters where appointment_id=$1', [first.appointment.id]);
    await assert.rejects(db.query('select * from public.record_specialty_exam($1,$2,$3,$4,null)',
      [encounter, actor, 'Patient symptoms', 'Preliminary diagnosis']), /Only the assigned specialist/);
    await assert.rejects(db.query('select * from public.record_specialty_exam($1,$2,$3,$4,null)',
      [encounter, otherDoctorActor, 'Patient symptoms', 'Preliminary diagnosis']), /Only the assigned specialist/);
    assert.equal(await scalar('select status from public.clinical_encounters where id=$1', [encounter]), 'waiting');
    await db.query("update public.app_users set role='head' where id=$1", [otherDoctorActor]);
    await assert.rejects(db.query('select * from public.finalize_clinic_visit($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [first.appointment.id, otherDoctorActor, 'Patient summary', 'Final diagnosis', 'Care instructions', 'Follow up', true, [], []]), /All specialist results/);
    await db.query('select * from public.record_specialty_exam($1,$2,$3,$4,null,null)',
      [encounter, doctorActor, 'Patient symptoms', 'Preliminary diagnosis']);
      await db.query('select * from public.finalize_clinic_visit($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [first.appointment.id, otherDoctorActor, 'Patient summary', 'Final diagnosis', 'Care instructions', 'Follow up',
          true, [{ name: 'Test medicine', dosage: '1 tablet', frequency: 'Twice daily', duration: '3 days', quantity: 6 }],
        [{ name: 'Test material', quantity: 2 }]]);
    assert.equal(await scalar('select count(*)::int from public.prescription_items where appointment_id=$1', [first.appointment.id]), 1);
    assert.equal(await scalar('select count(*)::int from public.clinical_material_usage where appointment_id=$1', [first.appointment.id]), 1);
    const activity = await scalar("select public.clinic_activity_report((now() at time zone 'Asia/Ho_Chi_Minh')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date,null,null)");
    assert.ok(Number(activity.prescriptionItems) >= 1);
    assert.ok(Number(activity.materialItems) >= 1);
    assert.equal(await scalar('select status from public.appointments where id=$1', [first.appointment.id]), 'completed');
    assert.equal((await db.query('select status from public.confirm_clinic_deposit($1)', [payment])).rows[0].status, 'completed');
    assert.equal(await scalar("select count(*)::int from public.appointment_email_outbox where appointment_id=$1 and kind='completed'", [first.appointment.id]), 1);
    const nextPatient = await scalar('select id from public.patient_medical_profiles where id<>$1 and owner_profile_id=$2 limit 1', [source.patient_medical_profile_id, source.owner_profile_id]);
    const second = await scalar('select public.create_clinic_booking($1)', [{ ...source, patient_medical_profile_id: nextPatient }]);
    const doctorId = source.doctor_id;
    const leaveDate = await scalar('select slot_date from public.appointment_slots where id=$1', [source.appointment_slot_id]);
    await db.query('select * from public.set_clinic_doctor_absence($1,true,$2,$2,$3)', [doctorId, leaveDate, 'Emergency leave']);
    assert.equal(await scalar('select clinician_absent from public.appointments where id=$1', [second.appointment.id]), true);
    assert.equal(await scalar("select count(*)::int from public.appointment_email_outbox where appointment_id=$1 and kind='doctor_absent'", [second.appointment.id]), 1);
    await db.exec('update public.appointment_slots set capacity=3');
    assert.equal((await db.query('select * from public.claim_appointment_slot($1)', [source.appointment_slot_id])).rows.length, 0);
    const substitute = await scalar("insert into public.doctors(full_name,specialty_id) values ('Substitute doctor',$1) returning id", [source.specialty_id]);
    const newSlot = await scalar("insert into public.appointment_slots(doctor_id,specialty_id,slot_date,start_time,end_time) values ($1,$2,$3,'10:00','10:30') returning id",
      [substitute, source.specialty_id, leaveDate]);
    await db.query('select * from public.reschedule_clinic_appointment($1,$2)', [second.appointment.id, newSlot]);
    assert.equal(await scalar('select doctor_id from public.appointments where id=$1', [second.appointment.id]), substitute);
    assert.ok(await scalar('select rescheduled_at from public.appointments where id=$1', [second.appointment.id]));
    assert.equal(await scalar('select booked_count from public.appointment_slots where id=$1', [source.appointment_slot_id]), 1);
    assert.equal(await scalar('select booked_count from public.appointment_slots where id=$1', [newSlot]), 1);
    assert.equal(await scalar("select count(*)::int from public.appointment_email_outbox where appointment_id=$1 and kind='rescheduled'", [second.appointment.id]), 1);
    const wrongSpecialty = await scalar("insert into public.clinic_specialties(name,slug) values ('Other specialty','other-specialty') returning id");
    const wrongDoctor = await scalar("insert into public.doctors(full_name,specialty_id) values ('Wrong specialty doctor',$1) returning id", [wrongSpecialty]);
    const wrongSlot = await scalar("insert into public.appointment_slots(doctor_id,specialty_id,slot_date,start_time,end_time) values ($1,$2,$3,'11:00','11:30') returning id",
      [wrongDoctor, wrongSpecialty, leaveDate]);
    await assert.rejects(db.query('select * from public.reschedule_clinic_appointment($1,$2)', [second.appointment.id, wrongSlot]), /same specialty/);
    assert.equal(await scalar('select booked_count from public.appointment_slots where id=$1', [wrongSlot]), 0);
    assert.equal(await scalar('select appointment_slot_id from public.appointments where id=$1', [second.appointment.id]), newSlot);
    await db.query('select * from public.set_clinic_doctor_absence($1,false,null,null,$2)', [doctorId, '']);
    assert.equal(await scalar('select clinician_absent from public.appointments where id=$1', [second.appointment.id]), false);
    const secondPayment = await scalar(`insert into public.payments(appointment_id,owner_profile_id,amount,status)
      select id,owner_profile_id,deposit_amount,'paid' from public.appointments where id=$1 returning id`, [second.appointment.id]);
    await db.query('select * from public.confirm_clinic_deposit($1)', [secondPayment]);
    await db.query("update public.appointments set appointment_date=((now() at time zone 'Asia/Ho_Chi_Minh')-interval '20 minutes')::date, appointment_time=((now() at time zone 'Asia/Ho_Chi_Minh')-interval '20 minutes')::time, delay_minutes=30 where id=$1", [second.appointment.id]);
    await assert.rejects(db.query("select * from public.transition_clinic_appointment($1,null,null,'no_show')", [second.appointment.id]), /Wait 15 minutes/);
    await db.query("update public.appointments set appointment_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date-1, appointment_time='00:00' where id=$1", [second.appointment.id]);
    await db.query("select * from public.transition_clinic_appointment($1,null,null,'no_show')", [second.appointment.id]);
    assert.equal(await scalar('select status from public.appointments where id=$1', [second.appointment.id]), 'no_show');
  });
  await check('seed can run twice without duplicate virtual doctors', async () => {
    const seed = await read('supabase/seed.sql');
    await db.exec(seed);
    // The seed contains clinic catalog data only. Real doctors are loaded from
    // verified clinic records, so seeding must not create fictional clinicians.
    assert.equal(await scalar('select count(*)::int from public.doctors where is_demo'), 0);
    await db.exec(seed);
    assert.equal(await scalar('select count(*)::int from public.doctors where is_demo'), 0);
  });
  await check('head workflow RPCs and access rules exist in the schema snapshot', async () => {
    for (const fn of [
      'public.record_specialty_exam(uuid,uuid,text,text,uuid,uuid,jsonb)',
      'public.finalize_clinic_visit(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb)',
      'public.append_clinical_note_addendum(uuid,uuid,text)',
      'public.clinic_activity_report(date,date,uuid,uuid)',
    ]) assert.equal(await scalar('select to_regprocedure($1) is not null', [fn]), true);
    assert.equal(await scalar("select has_function_privilege('service_role','public.finalize_clinic_visit(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb)','EXECUTE')"), true);
    assert.equal(await scalar("select has_function_privilege('anon','public.finalize_clinic_visit(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb)','EXECUTE')"), false);
  });
  console.log(`Database checks passed: ${checks.length}. PostgreSQL WASM; external services and multi-connection races are not covered.`);
} catch (error) {
  console.error(`Database check failed: ${error.message}`);
  process.exitCode = 1;
} finally { await db.close(); }
