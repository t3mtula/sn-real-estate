import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  return (
    <ContentSection
      title='หน้าตา'
      desc='เลือกธีม + ฟอนต์ที่จะใช้ในแอป · ค่าเริ่มต้นเป็นโทนสว่าง + Sarabun'
    >
      <AppearanceForm />
    </ContentSection>
  )
}
